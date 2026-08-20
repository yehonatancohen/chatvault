import type { Attachment, MessageKind } from "../types.js";

/**
 * Classification of message bodies into attachments, omitted media, deletions and plain text.
 *
 * WhatsApp localizes every one of these markers, and there are ~60 supported languages. Rather
 * than chase an exhaustive table we match on *shape* — a bracketed body whose payload looks
 * like a filename is an attachment in any language — and fall back to a small table of exact
 * strings for the cases shape cannot distinguish.
 *
 * Classification is always lossless: an unrecognised body stays `text` with its content
 * untouched. Misclassifying is a display bug; losing the body would be data loss.
 */

/** A token that plausibly names a file: something, a dot, a short extension. */
const FILENAME_RE = /^[^\s<>:"/\\|?*]+\.[A-Za-z0-9]{2,5}$/;

/**
 * Markers are matched as a **tail**, with anything before them captured as the caption.
 *
 * This is not a defensive nicety — it is the shape WhatsApp actually emits. A captioned photo
 * is one message whose body is `caption ‎<marker>`, with the marker last and preceded by an
 * LRM (already stripped by normalization before we get here):
 *
 *     Sender: תראה מה מצאתי ‎<attached: 00000043-PHOTO-2025-03-14-20-10-34.jpg>
 *     Sender: תראה מה מצאתי ‎image omitted        (the same message, exported without media)
 *
 * Anchoring these patterns to the whole body — `^<attached: …>$` — fails on every captioned
 * photo, silently demoting it to plain text and discarding the attachment. Worse, identity
 * then falls back to the body hash, and since the two exports' bodies differ only in the
 * marker, the same photo lands twice in a merged archive.
 */

/** iOS: `<attached: IMG_0001.JPG>`, `<מצורף: …>`, `<adjunto: …>` — localized key, same shape. */
const IOS_ATTACHMENT_TAIL = /^(.*?)\s*<[^:>]{1,40}:\s*([^>]+?)\s*>$/;

/** Android: `IMG-20240315-WA0001.jpg (file attached)`, `… (קובץ מצורף)`. */
const ANDROID_ATTACHMENT_TAIL = /^(.*?)\s*(\S+)\s*\([^()]{1,40}\)$/;

/**
 * Omitted-media placeholders. iOS writes these in **English even in a Hebrew chat**, so the
 * English forms are the common case rather than a fallback. Note they are unbracketed on iOS
 * (`image omitted`) and bracketed on Android (`<Media omitted>`).
 *
 * A with-media export still contains these for media no longer present on the device, so they
 * are not merely the "exported without media" case.
 */
const OMITTED_TAIL =
  /^(.*?)\s*(?:<[^>]*omitted[^>]*>|<Media omitted>|(?:image|video|audio|sticker|GIF|document|contact card)\s+omitted|<המדיה לא נכללה>)$/i;

/**
 * Exact bodies meaning "this message was deleted". Per-member by nature: the sender sees
 * "You deleted this message" where everyone else sees "This message was deleted", so these
 * must never be merged as if they were the same event.
 */
const DELETED_BODIES: ReadonlySet<string> = new Set([
  "this message was deleted",
  "you deleted this message",
  "this message was deleted.",
  "הודעה זו נמחקה",
  "מחקת הודעה זו",
  "se eliminó este mensaje",
  "eliminaste este mensaje",
  "cette message a été supprimé",
  "diese nachricht wurde gelöscht",
]);

export interface Classification {
  readonly kind: MessageKind;
  readonly attachment?: Attachment;
  /**
   * Text the user typed alongside the media, taken from before the marker. Empty when the
   * media had no caption. Only meaningful for the media kinds.
   */
  readonly caption?: string;
}

/**
 * Classify a message body that has already been separated from its header.
 * `hasSender` is false for system lines, which are never attachments.
 */
export function classifyBody(body: string, hasSender: boolean): Classification {
  const trimmed = body.trim();

  if (!hasSender) return { kind: "system" };

  if (DELETED_BODIES.has(trimmed.toLowerCase())) return { kind: "deleted" };

  const ios = IOS_ATTACHMENT_TAIL.exec(trimmed);
  if (ios?.[2] !== undefined && FILENAME_RE.test(ios[2])) {
    return {
      kind: "attachment",
      attachment: { filename: ios[2] },
      caption: (ios[1] ?? "").trim(),
    };
  }

  const android = ANDROID_ATTACHMENT_TAIL.exec(trimmed);
  if (android?.[2] !== undefined && FILENAME_RE.test(android[2])) {
    return {
      kind: "attachment",
      attachment: { filename: android[2] },
      caption: (android[1] ?? "").trim(),
    };
  }

  const omitted = OMITTED_TAIL.exec(trimmed);
  if (omitted) {
    return { kind: "omitted-media", caption: (omitted[1] ?? "").trim() };
  }

  return { kind: "text" };
}

/**
 * Verbs that make a *name-position* phrase a system event rather than a sender.
 *
 * These are checked **only against the text before the first colon**, never against a whole
 * line. That distinction is the entire point: `Dana: I left my keys at home` and
 * `Ravid: I changed my mind` are ordinary messages containing these verbs, and a pattern
 * loose enough to span the sender prefix silently converts them into system messages —
 * losing the sender, corrupting the participant list, and mislabelling them with the one kind
 * that merge treats as per-participant.
 *
 * A real message always has a `Sender: ` prefix, so the only thing this needs to catch is a
 * system event that happens to contain a colon, such as
 * `You changed the group name to: Trip`.
 */
const SYSTEM_PHRASE_RE =
  /^(you|.{1,60}?) (changed|added|removed|created|joined|left|turned|pinned|deleted)\b/i;

/**
 * Does the text preceding the first colon read as a system event rather than a person's name?
 *
 * Pass only the name-position candidate — `splitSender` in `parse.ts` is the sole caller and
 * does exactly that.
 */
export function looksLikeSystemPhrase(nameCandidate: string): boolean {
  return SYSTEM_PHRASE_RE.test(nameCandidate.trim());
}
