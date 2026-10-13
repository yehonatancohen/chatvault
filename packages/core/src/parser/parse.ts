import { computeMessageId } from "../identity.js";
import type {
  DateOrder,
  ExportDialect,
  ParseIssue,
  ParsedMessage,
  ParseResult,
} from "../types.js";
import {
  inferClock,
  inferDateOrder,
  inferHasSeconds,
  resolveDateTime,
  tokenizeDateTime,
  wallClockToEpoch,
  type DateTimeTokens,
} from "./datetime.js";
import {
  classifyBody,
  looksLikeNotice,
  looksLikeSystemPhrase,
  type Classification,
} from "./markers.js";
import { afterLastDirectionMark, normalizeInvisibles, startsWithDirectionMark } from "./text.js";

/**
 * The WhatsApp export parser.
 *
 * Runs in two passes on purpose. The first pass finds every line that *could* be a message
 * header and collects its raw numeric shape; only then can the file's date field order and
 * clock convention be inferred from the evidence as a whole. A single-pass parser has to
 * guess `03/04` on the first line it sees, and a wrong guess shifts an entire archive by
 * months without ever failing loudly.
 */

export interface ParseOptions {
  /**
   * Assumed UTC offset of the wall-clock times in this export, in minutes east of UTC.
   * Exports carry no timezone. Default 0 — fine as long as all merged sources share a zone.
   */
  readonly tzOffsetMinutes?: number;
  /** Used only when the file is genuinely ambiguous about day/month order. */
  readonly dateOrderFallback?: DateOrder;
}

interface HeaderSplit {
  readonly tokens: DateTimeTokens;
  readonly remainder: string;
  readonly platform: "ios" | "android";
}

/**
 * Try to read a line as `<datetime><separator><rest>`.
 *
 * iOS brackets the datetime; Android separates it with ` - `. Returning `null` is the normal
 * and expected signal that the line continues the previous message.
 */
function splitHeader(line: string): HeaderSplit | null {
  if (line.startsWith("[")) {
    const close = line.indexOf("]");
    if (close > 0) {
      const tokens = tokenizeDateTime(line.slice(1, close));
      if (tokens) {
        return { tokens, remainder: line.slice(close + 1).trimStart(), platform: "ios" };
      }
    }
    return null;
  }

  // Android. The datetime never contains " - ", so the first occurrence is the separator.
  const sep = line.indexOf(" - ");
  if (sep > 0) {
    const tokens = tokenizeDateTime(line.slice(0, sep));
    if (tokens) {
      return { tokens, remainder: line.slice(sep + 3), platform: "android" };
    }
  }
  return null;
}

/**
 * Is this header written the way the file's first one was? iOS always prints seconds, so a
 * bracketed line without them inside an iOS export is not one of its headers.
 */
function fitsFile(candidate: HeaderSplit, shape: HeaderSplit | undefined): boolean {
  if (shape === undefined) return true;
  if (candidate.platform !== shape.platform) return false;
  if (candidate.tokens.timeFirst !== shape.tokens.timeFirst) return false;
  if (shape.platform === "ios") {
    return (candidate.tokens.second === null) === (shape.tokens.second === null);
  }
  return true;
}

/**
 * The same split on the *raw* line, to see where WhatsApp's direction marks stood. Only ever
 * called for a line `splitHeader` has already accepted.
 */
function rawRemainderOf(rawLine: string, platform: "ios" | "android"): string {
  const at = platform === "ios" ? rawLine.indexOf("]") : rawLine.indexOf(" - ");
  return at < 0 ? "" : rawLine.slice(at + (platform === "ios" ? 1 : 3)).replace(/^ +/, "");
}

/** Sender names are short and never contain a colon or newline. */
const SENDER_RE = /^([^:\n]{1,80}):[ ]?([\s\S]*)$/;

interface SenderSplit {
  readonly sender: string | null;
  readonly body: string;
}

/**
 * Separate `Sender: body` from a system line.
 *
 * Every real message carries a `Sender: ` prefix, so the absence of a colon is itself the
 * signal for a system event ("Messages and calls are end-to-end encrypted.", "Dana joined
 * using this group's invite link"). Only when a colon *is* present do we need to ask whether
 * the name-position text is really a name — which is how `You changed the group name to: Trip`
 * is kept from becoming a sender.
 */
function splitSender(remainder: string): SenderSplit {
  const m = SENDER_RE.exec(remainder);
  if (!m?.[1]) return { sender: null, body: remainder };

  const nameCandidate = m[1].trim();
  if (looksLikeSystemPhrase(nameCandidate)) return { sender: null, body: remainder };

  return { sender: nameCandidate, body: m[2] ?? "" };
}

/** A header-split line plus the continuation lines that belong to it. */
interface RawMessage {
  readonly header: HeaderSplit;
  readonly lines: string[];
  /** The same lines before normalization — the only place the direction marks survive. */
  readonly rawLines: string[];
  readonly lineNumber: number;
}

const isMediaKind = (c: Classification): boolean =>
  c.kind === "attachment" || c.kind === "omitted-media";

export function parseExport(raw: string, options: ParseOptions = {}): ParseResult {
  const tzOffsetMinutes = options.tzOffsetMinutes ?? 0;

  // Split first and normalize each line, keeping the raw line beside it. Normalization never
  // adds or removes a line break, so this is the same text the regexes always saw.
  const rawLines = raw.replace(/\r\n?/g, "\n").split("\n");
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") rawLines.pop();
  const lines = rawLines.map(normalizeInvisibles);

  // ---- Pass 1: find headers, fold continuations, gather dialect evidence ----
  const rawMessages: RawMessage[] = [];
  const issues: ParseIssue[] = [];
  const samples: DateTimeTokens[] = [];

  /** The first header fixes what a header looks like in this file. */
  let shape: HeaderSplit | undefined;

  for (const [index, line] of lines.entries()) {
    const candidate = splitHeader(line);
    const rawLine = rawLines[index] ?? "";

    // One export is written by one phone in one format. A line in any *other* format is text
    // someone pasted — most often messages copied out of WhatsApp Web, which look like
    // `[7:34 PM, 11/25/2021] Dana: …` — and belongs to the message it was pasted into.
    const header = candidate !== null && fitsFile(candidate, shape) ? candidate : null;
    shape ??= header ?? undefined;

    if (header) {
      samples.push(header.tokens);
      rawMessages.push({
        header,
        lines: [header.remainder],
        rawLines: [rawLine],
        lineNumber: index + 1,
      });
      continue;
    }

    const current = rawMessages[rawMessages.length - 1];
    if (current) {
      // A continuation of a multi-line message. Blank lines inside a message are content.
      current.lines.push(line);
      current.rawLines.push(rawLine);
    } else if (line.trim() !== "") {
      // Text before the first parsable header — a truncated export, or a format we do not
      // understand. Recorded, never silently dropped.
      issues.push({ line: index + 1, reason: "unparsable-header", raw: line });
    }
  }

  const dialect: ExportDialect = {
    dateOrder: inferDateOrder(samples, options.dateOrderFallback ?? "DMY"),
    platform: rawMessages[0]?.header.platform ?? "unknown",
    hasSeconds: inferHasSeconds(samples),
    clock: inferClock(samples),
  };

  // ---- Pass 2: resolve dates under the inferred dialect and build messages ----
  const messages: ParsedMessage[] = [];
  /** Senders in first-appearance order, with whether anything they "sent" was really theirs. */
  const senders = new Map<string, boolean>();

  /** Counts media messages per `sender@minute`, to assign the ordinal identity depends on. */
  const mediaOrdinals = new Map<string, number>();
  /** Counts messages that would otherwise share an id — the same text again within a minute. */
  const repeats = new Map<string, number>();
  /** Counts messages printed with the same timestamp, to keep them in the order written. */
  const sameInstant = new Map<number, number>();

  for (const rawMessage of rawMessages) {
    const resolved = resolveDateTime(rawMessage.header.tokens, dialect.dateOrder);
    if (!resolved) {
      issues.push({
        line: rawMessage.lineNumber,
        reason: "bad-datetime",
        raw: rawMessage.lines[0] ?? "",
      });
      continue;
    }

    const platform = rawMessage.header.platform;
    const rawFirst = rawMessage.rawLines[0] ?? "";
    const rawRemainder = rawRemainderOf(rawFirst, platform);

    const { sender, body: firstLine } = splitSender(rawMessage.lines[0] ?? "");
    const continuation = rawMessage.lines.slice(1);

    // Where the marks stood. iOS marks a media line before its `[`; both platforms mark a body
    // they generated at its start.
    const mediaLine = platform === "ios" && startsWithDirectionMark(rawFirst);
    const rawBody = sender === null ? rawRemainder : rawRemainder.slice(rawRemainder.indexOf(":") + 1);
    const generated = startsWithDirectionMark(rawBody.replace(/^ +/, ""));

    // Classify against the first line, because that is where the marker lives: a captioned
    // photo is a single line — `Sender: caption <marker>` — so the caption comes back from the
    // classifier, and any further lines are ordinary continuations of it.
    let classification = classifyBody(firstLine, sender !== null, {
      mediaLine,
      markedTail: mediaLine ? afterLastDirectionMark(rawFirst) : undefined,
      generated,
      platform,
    });
    let bodyLines: string[];

    if (mediaLine && sender !== null && continuation.length > 0 && !isMediaKind(classification)) {
      // A caption of several lines: iOS still writes the marker last, so it is at the end of
      // the message's final line and the first line holds none.
      const lastIndex = rawMessage.rawLines.length - 1;
      const atEnd = classifyBody(rawMessage.lines[lastIndex] ?? "", true, {
        mediaLine: true,
        markedTail: afterLastDirectionMark(rawMessage.rawLines[lastIndex] ?? ""),
        platform,
      });
      if (isMediaKind(atEnd)) {
        classification = atEnd;
        const lastCaption = atEnd.caption ?? "";
        bodyLines = [firstLine, ...continuation.slice(0, -1), ...(lastCaption === "" ? [] : [lastCaption])];
      } else {
        bodyLines = [firstLine, ...continuation];
      }
    } else if (isMediaKind(classification)) {
      // For media the marker itself is metadata, never body text: the body is the caption the
      // classifier pulled out from before it, plus any continuation lines. Keeping the marker
      // in the body would make the same photo hash differently in a with-media and a
      // without-media export, and duplicate it on merge.
      //
      // The leading text is dropped only when it is genuinely absent (uncaptioned media).
      // Blank *continuation* lines are content — a user's deliberate paragraph break — and
      // filtering those out would silently reflow multi-line messages.
      const caption = classification.caption ?? "";
      bodyLines = caption === "" ? continuation : [caption, ...continuation];
    } else {
      bodyLines = [firstLine, ...continuation];
    }
    // `Sender:` with the text starting on the next line — the empty first line is not content.
    if (bodyLines.length > 1 && bodyLines[0] === "") bodyLines.shift();

    const isMedia = isMediaKind(classification);
    const body = bodyLines.join("\n");

    if (sender !== null) {
      // A name WhatsApp files its own notices under — an iOS group's title — is not a person in
      // the chat. It counts as a participant only once it has said something.
      const spoke = isMedia || classification.kind !== "text" || !looksLikeNotice(body);
      senders.set(sender, (senders.get(sender) ?? false) || spoke);
    }

    const minute = resolved.wallClock.slice(0, 16);

    let mediaOrdinal: number | undefined;
    if (isMedia) {
      const key = `${sender ?? ""}@${minute}`;
      mediaOrdinal = mediaOrdinals.get(key) ?? 0;
      mediaOrdinals.set(key, mediaOrdinal + 1);
    }

    const identity = {
      wallClock: resolved.wallClock,
      sender,
      body,
      kind: classification.kind,
      ...(mediaOrdinal !== undefined ? { mediaOrdinal } : {}),
    };
    let id = computeMessageId(identity);
    if (!isMedia) {
      const occurrence = repeats.get(id) ?? 0;
      repeats.set(id, occurrence + 1);
      if (occurrence > 0) id = computeMessageId({ ...identity, occurrence });
    }

    // Android prints no seconds, and several messages can share one on iOS. Merge orders by
    // time, so each later message of the same printed instant is nudged one millisecond on —
    // enough to keep the order the export was written in, and far too little to show.
    const instant = wallClockToEpoch(resolved, tzOffsetMinutes);
    const sameSoFar = sameInstant.get(instant) ?? 0;
    sameInstant.set(instant, sameSoFar + 1);
    const ts = instant + Math.min(sameSoFar, dialect.hasSeconds ? 999 : 59_999);

    messages.push({
      id,
      ts,
      wallClock: resolved.wallClock,
      sender,
      body,
      kind: classification.kind,
      ...(classification.attachment ? { attachment: classification.attachment } : {}),
    });
  }

  const participants = [...senders].filter(([, spoke]) => spoke).map(([name]) => name);

  return { messages, issues, dialect, participants };
}
