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
import { classifyBody, looksLikeSystemPhrase } from "./markers.js";
import { normalizeExportText, toLines } from "./text.js";

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
  readonly lineNumber: number;
}

export function parseExport(raw: string, options: ParseOptions = {}): ParseResult {
  const tzOffsetMinutes = options.tzOffsetMinutes ?? 0;
  const lines = toLines(normalizeExportText(raw));

  // ---- Pass 1: find headers, fold continuations, gather dialect evidence ----
  const rawMessages: RawMessage[] = [];
  const issues: ParseIssue[] = [];
  const samples: DateTimeTokens[] = [];

  for (const [index, line] of lines.entries()) {
    const header = splitHeader(line);

    if (header) {
      samples.push(header.tokens);
      rawMessages.push({ header, lines: [header.remainder], lineNumber: index + 1 });
      continue;
    }

    const current = rawMessages[rawMessages.length - 1];
    if (current) {
      // A continuation of a multi-line message. Blank lines inside a message are content.
      current.lines.push(line);
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
  const participants: string[] = [];
  const seenParticipants = new Set<string>();

  /** Counts media messages per `sender@minute`, to assign the ordinal identity depends on. */
  const mediaOrdinals = new Map<string, number>();

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

    const { sender, body: firstLine } = splitSender(rawMessage.lines[0] ?? "");
    const continuation = rawMessage.lines.slice(1);

    // Classify against the first line alone, because the marker lives at the end of that line
    // and `classifyBody` matches it as a tail. A captioned photo is a single line —
    // `Sender: caption <marker>` — so the caption comes back from the classifier, and any
    // further lines are ordinary continuations of it.
    const classification = classifyBody(firstLine, sender !== null);
    const isMedia =
      classification.kind === "attachment" || classification.kind === "omitted-media";

    // For media the marker itself is metadata, never body text: the body is the caption the
    // classifier pulled out from before it, plus any continuation lines. Keeping the marker
    // in the body would make the same photo hash differently in a with-media and a
    // without-media export, and duplicate it on merge.
    const leadingText = isMedia ? (classification.caption ?? "") : firstLine;

    // Drop the leading text only when it is genuinely absent (uncaptioned media). Blank
    // *continuation* lines are content — a user's deliberate paragraph break — and filtering
    // those out would silently reflow multi-line messages.
    const body = (leadingText === "" ? continuation : [leadingText, ...continuation]).join("\n");

    if (sender !== null && !seenParticipants.has(sender)) {
      seenParticipants.add(sender);
      participants.push(sender);
    }

    let mediaOrdinal: number | undefined;
    if (isMedia) {
      const key = `${sender ?? ""}@${resolved.wallClock.slice(0, 16)}`;
      mediaOrdinal = mediaOrdinals.get(key) ?? 0;
      mediaOrdinals.set(key, mediaOrdinal + 1);
    }

    const id = computeMessageId({
      wallClock: resolved.wallClock,
      sender,
      body,
      kind: classification.kind,
      ...(mediaOrdinal !== undefined ? { mediaOrdinal } : {}),
    });

    messages.push({
      id,
      ts: wallClockToEpoch(resolved, tzOffsetMinutes),
      wallClock: resolved.wallClock,
      sender,
      body,
      kind: classification.kind,
      ...(classification.attachment ? { attachment: classification.attachment } : {}),
    });
  }

  return { messages, issues, dialect, participants };
}
