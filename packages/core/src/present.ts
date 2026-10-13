import { isDeletedBody, looksLikeNotice } from "./parser/markers.js";
import type { MessageKind } from "./types.js";

/**
 * What a stored message *is*, for whoever draws it.
 *
 * An export is text, and WhatsApp flattens everything into it: a poll is five lines, a location
 * is a link with a word in front, a call is a sentence, an edit is a suffix. The archive stores
 * that text as it came — so that ids never move and nothing is lost — and this is where it is
 * read back into the thing the reader saw in WhatsApp.
 *
 * It is a pure function of a stored message, which has two consequences worth keeping:
 *
 * - **It works on every archive ever written**, including ones made before a shape was known.
 *   Teaching it a new shape needs no re-import and no format change.
 * - **It never changes what is stored.** Anything it does not recognise is plain text, whole.
 *
 * The app and the website both draw from this, so they cannot disagree about what a message is.
 */

export type MediaType =
  | "image"
  | "video"
  | "audio"
  | "sticker"
  | "gif"
  | "document"
  | "contact"
  | "other";

export interface PollOption {
  readonly text: string;
  /** `null` when the export did not print a count. */
  readonly votes: number | null;
}

interface Base {
  /** WhatsApp marked the message as edited after sending. */
  readonly edited: boolean;
}

export type MessageView = Base &
  (
    | { readonly type: "text"; readonly text: string }
    /** A line WhatsApp wrote itself — shown centred, never as someone's bubble. */
    | { readonly type: "notice"; readonly text: string }
    | { readonly type: "deleted" }
    | {
        readonly type: "media";
        readonly media: MediaType;
        /** The export named a file. Whether the archive *holds* it is `attachment.sha256`. */
        readonly filename?: string;
        /** A document's or contact's own name, when the export printed one. */
        readonly title?: string;
        /** What WhatsApp printed after a document's name, e.g. `2 pages`. */
        readonly detail?: string;
        readonly caption: string;
      }
    | {
        readonly type: "location";
        readonly live: boolean;
        readonly url?: string;
        readonly latitude?: number;
        readonly longitude?: number;
        /** A named place, when one was shared rather than a bare pin. */
        readonly label?: string;
      }
    | { readonly type: "poll"; readonly question: string; readonly options: readonly PollOption[] }
    | {
        readonly type: "call";
        readonly video: boolean;
        readonly group: boolean;
        readonly missed: boolean;
        /** The line as WhatsApp wrote it, which may carry a duration. */
        readonly text: string;
      }
    /** Something WhatsApp left out of the export altogether (a view-once photo, a pending message). */
    | { readonly type: "unavailable"; readonly text: string }
  );

export interface DescribableMessage {
  readonly kind: MessageKind;
  readonly body: string;
  readonly attachment?: { readonly filename: string } | undefined;
}

/**
 * The suffix WhatsApp appends to a message that was edited, in the app languages we know. It is
 * left in the stored body (it is part of what the export said, and of the message's id) and
 * taken off here.
 */
const EDITED_TAIL =
  /\s*<(?:This message was edited|ההודעה נערכה|הודעה זו נערכה|Se editó este mensaje|Diese Nachricht wurde bearbeitet|Ce message a été modifié|Questo messaggio è stato modificato|Mensagem editada|Данное сообщение изменено|تم تعديل هذه الرسالة)>\s*$/i;

const POLL_HEAD = /^(?:POLL|סקר):\s*$/i;
const POLL_OPTION = /^(?:OPTION|אפשרות):\s*(.*?)(?:\s*\((\d+)[^()]*\))?\s*$/i;

/** `Location: https://maps.google.com/?q=32.08,34.78` — the word before the link is localized. */
const LOCATION = /^(?:[^\n:/]{1,40}:\s*)?(https:\/\/maps\.google\.[a-z.]{2,6}\/\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?))\s*$/;
/** A named place: `Pimlico Gardens (London): https://foursquare.com/v/…`, or over three lines on Android. */
const PLACE = /^([^]{1,200}?)[:\n]\s*(https:\/\/foursquare\.com\/v\/\S+)\s*$/;
const LIVE_LOCATION = /^(?:live location shared|מיקום בזמן אמת שותף)\.?$/i;

const CALL_EN = /^(missed )?(group )?(voice|video) call(?:[.,] .{1,40})?\.?$/i;
const CALL_HE = /^(שיחה קולית|שיחת וידאו)( קבוצתית)?( שלא נענתה)?(?:[.,] .{1,40})?\.?$/;

/** What Android writes where it had nothing to export, and iOS for a message still in transit. */
const UNAVAILABLE = /^(?:null|waiting for this message(?:\. this may take a while\.?)?)$/i;

/** `Report.pdf • 2 pages` — how iOS introduces a document, where a caption would otherwise go. */
const DOCUMENT_LINE = /^(.+\.[A-Za-z0-9]{1,8})(?: • (.{1,40}))?$/;

const EXTENSIONS: Readonly<Record<string, MediaType>> = {
  jpg: "image", jpeg: "image", png: "image", heic: "image", heif: "image", bmp: "image",
  webp: "image", gif: "gif",
  mp4: "video", mov: "video", m4v: "video", "3gp": "video", mkv: "video", webm: "video",
  opus: "audio", ogg: "audio", oga: "audio", m4a: "audio", mp3: "audio", aac: "audio",
  wav: "audio", amr: "audio",
  vcf: "contact",
};

/**
 * What kind of thing a file is, from the name WhatsApp gave it. Both platforms say so in the
 * name itself (`…-STICKER-…`, `STK-…`), which is the only way to tell a sticker from a photo
 * or a GIF — WhatsApp exports those as `.mp4` — from a video.
 */
export function mediaTypeOf(filename: string): MediaType {
  const name = filename.toUpperCase();
  if (/(^|-)STICKER-|^STK-/.test(name)) return "sticker";
  if (/(^|-)GIF-/.test(name)) return "gif";
  if (/(^|-)PHOTO-|^IMG-/.test(name)) return "image";
  if (/(^|-)VIDEO-|^VID-/.test(name)) return "video";
  if (/(^|-)AUDIO-|^(AUD|PTT)-/.test(name)) return "audio";
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(filename)?.[1]?.toLowerCase() ?? "";
  return EXTENSIONS[ext] ?? "document";
}

/** A file's name as its sender knew it: without iOS's `00000046-` counter. */
export function displayFilename(filename: string): string {
  return filename.replace(/^\d{6,}-/, "");
}

function describeMedia(message: DescribableMessage, edited: boolean, body: string): MessageView {
  const filename = message.attachment?.filename;
  const lines = body.split("\n");
  const first = lines[0] ?? "";

  let media: MediaType = filename === undefined ? "other" : mediaTypeOf(filename);
  let title: string | undefined;
  let detail: string | undefined;
  let caption = body;

  // A document's line names the file again; it is the document's title, not something typed.
  const doc = DOCUMENT_LINE.exec(first);
  if (
    doc?.[1] !== undefined &&
    (filename === undefined ? lines.length === 1 : displayFilename(filename) === doc[1])
  ) {
    title = doc[1];
    detail = doc[2];
    caption = lines.slice(1).join("\n");
    if (filename === undefined) media = mediaTypeOf(doc[1]);
  } else if (filename !== undefined && (media === "document" || media === "contact")) {
    title = displayFilename(filename);
  }
  if (media === "contact" && title !== undefined) title = title.replace(/\.vcf$/i, "");

  return {
    type: "media",
    media,
    ...(filename !== undefined ? { filename } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(detail !== undefined ? { detail } : {}),
    caption,
    edited,
  };
}

function describePoll(lines: readonly string[]): { question: string; options: PollOption[] } | null {
  if (!POLL_HEAD.test(lines[0] ?? "")) return null;
  const question: string[] = [];
  const options: PollOption[] = [];
  for (const line of lines.slice(1)) {
    const option = POLL_OPTION.exec(line);
    if (option && /^(?:OPTION|אפשרות):/i.test(line)) {
      options.push({ text: option[1] ?? "", votes: option[2] === undefined ? null : Number(option[2]) });
    } else if (options.length === 0) {
      question.push(line);
    }
  }
  return options.length === 0 ? null : { question: question.join("\n").trim(), options };
}

/** Read a stored message back into what it was. See the note at the top of this file. */
export function describeMessage(message: DescribableMessage): MessageView {
  if (message.kind === "system") return { type: "notice", text: message.body, edited: false };

  const edited = EDITED_TAIL.test(message.body);
  const body = edited ? message.body.replace(EDITED_TAIL, "") : message.body;

  if (message.kind === "attachment" || message.kind === "omitted-media") {
    return describeMedia(message, edited, body);
  }

  const whole = body.trim();

  if (message.kind === "deleted" || isDeletedBody(whole)) return { type: "deleted", edited: false };
  if (looksLikeNotice(whole)) return { type: "notice", text: whole, edited: false };
  if (UNAVAILABLE.test(whole)) return { type: "unavailable", text: whole, edited: false };

  const location = LOCATION.exec(whole);
  if (location?.[1] !== undefined) {
    return {
      type: "location",
      live: false,
      url: location[1],
      latitude: Number(location[2]),
      longitude: Number(location[3]),
      edited: false,
    };
  }
  if (LIVE_LOCATION.test(whole)) return { type: "location", live: true, edited: false };
  const place = PLACE.exec(whole);
  if (place?.[2] !== undefined) {
    const label = (place[1] ?? "").replace(/\n+/g, ", ").trim();
    return { type: "location", live: false, url: place[2], ...(label !== "" ? { label } : {}), edited: false };
  }

  const poll = describePoll(whole.split("\n"));
  if (poll) return { type: "poll", ...poll, edited: false };

  if (!whole.includes("\n")) {
    const en = CALL_EN.exec(whole);
    if (en) {
      return {
        type: "call",
        missed: en[1] !== undefined,
        group: en[2] !== undefined,
        video: (en[3] ?? "").toLowerCase() === "video",
        text: whole,
        edited: false,
      };
    }
    const he = CALL_HE.exec(whole);
    if (he) {
      return {
        type: "call",
        video: he[1] === "שיחת וידאו",
        group: he[2] !== undefined,
        missed: he[3] !== undefined,
        text: whole,
        edited: false,
      };
    }
  }

  return { type: "text", text: body, edited };
}

/* ------------------------------------------------------------------------------------------
 * Text as WhatsApp sets it: *bold*, _italic_, ~struck~, `code`, and links that can be followed.
 * ---------------------------------------------------------------------------------------- */

export interface TextSpan {
  readonly text: string;
  readonly bold?: true;
  readonly italic?: true;
  readonly strike?: true;
  readonly code?: true;
  /** Always `http:` or `https:` — nothing else in a message is turned into a link. */
  readonly href?: string;
}

type Style = Omit<TextSpan, "text">;

const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"»”’]+$/;
const CODE = /```([^]+?)```|`([^`\n]+)`/g;

/**
 * WhatsApp's rule for `*`, `_` and `~`: the opening mark follows a non-letter and precedes a
 * non-space, the closing one the reverse, and the pair sits on one line. `2*3*4` and
 * `snake_case_name` are therefore left exactly as typed.
 */
const EMPHASIS: readonly [RegExp, keyof Style][] = [
  [/(^|[^\p{L}\p{N}*])\*(\S(?:[^*\n]*\S)?)\*(?![\p{L}\p{N}*])/u, "bold"],
  [/(^|[^\p{L}\p{N}_])_(\S(?:[^_\n]*\S)?)_(?![\p{L}\p{N}_])/u, "italic"],
  [/(^|[^\p{L}\p{N}~])~(\S(?:[^~\n]*\S)?)~(?![\p{L}\p{N}~])/u, "strike"],
];

function emphasise(text: string, style: Style, out: TextSpan[]): void {
  if (text === "") return;
  let best: { index: number; lead: string; inner: string; length: number; key: keyof Style } | undefined;
  for (const [re, key] of EMPHASIS) {
    if (style[key] !== undefined) continue;
    const m = re.exec(text);
    if (m && (best === undefined || m.index < best.index)) {
      best = { index: m.index, lead: m[1] ?? "", inner: m[2] ?? "", length: m[0].length, key };
    }
  }
  if (best === undefined) {
    out.push({ text, ...style });
    return;
  }
  const before = text.slice(0, best.index) + best.lead;
  if (before !== "") out.push({ text: before, ...style });
  emphasise(best.inner, { ...style, [best.key]: true }, out);
  emphasise(text.slice(best.index + best.length), style, out);
}

function linkify(text: string, out: TextSpan[]): void {
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0;
    const shown = m[0].replace(TRAILING_PUNCTUATION, "");
    if (shown.length < 5) continue;
    emphasise(text.slice(at, start), {}, out);
    out.push({ text: shown, href: /^https?:\/\//i.test(shown) ? shown : `https://${shown}` });
    at = start + shown.length;
  }
  emphasise(text.slice(at), {}, out);
}

/** Split a message's text into the runs a renderer needs. Concatenating `text` loses only the marks. */
export function formatText(text: string): TextSpan[] {
  const out: TextSpan[] = [];
  let at = 0;
  for (const m of text.matchAll(CODE)) {
    const start = m.index ?? 0;
    linkify(text.slice(at, start), out);
    out.push({ text: m[1] ?? m[2] ?? "", code: true });
    at = start + m[0].length;
  }
  linkify(text.slice(at), out);
  return out;
}
