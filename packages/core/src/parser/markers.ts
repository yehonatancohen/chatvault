import type { Attachment, MessageKind } from "../types.js";

/**
 * Classification of message bodies into attachments, omitted media, deletions and plain text.
 *
 * WhatsApp localizes every one of these markers, and there are ~60 supported languages. Two
 * things keep this from being an exhaustive table:
 *
 * - **Position.** WhatsApp writes a direction mark in front of text it generated, and on iOS in
 *   front of every media line. `parse.ts` reads those positions off the raw line and passes
 *   them in as `MarkerHints`; with them a media line is recognised in any language.
 * - **Shape.** A bracketed body whose payload looks like a filename is an attachment whatever
 *   the key says. The tables below are for what neither position nor shape can settle.
 *
 * Classification is always lossless: an unrecognised body stays `text` with its content
 * untouched. Misclassifying is a display bug; losing the body would be data loss.
 */

/** A token that plausibly names a file: something, a dot, a short extension. */
const FILENAME_RE = /^[^\s<>:"/\\|?*]+\.[A-Za-z0-9]{2,5}$/;

/** The same, but allowing spaces — only trusted where something else delimits the name. */
const SPACED_FILENAME_RE = /^[^<>\n]*[^<>\s.]\.[A-Za-z0-9]{1,8}$/;

/** iOS numbers every exported file: `00000046-Some file.txt`. */
const IOS_NUMBERED_FILENAME_RE = /^\d{6,}-[^<>\n]+\.[A-Za-z0-9]{1,8}$/;

/** Android names the media it received itself: `IMG-20240315-WA0001.jpg`, `PTT-…`, `STK-…`. */
const ANDROID_WA_FILENAME_RE = /^[A-Z]{3}-\d{8}-WA\d{3,}\.[A-Za-z0-9]{1,8}$/;

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

/** The marker alone, as it stands after the last direction mark of an iOS media line. */
const IOS_ATTACHMENT_MARKER = /^<[^:<>]{1,40}:\s*(.+?)\s*>$/;

/** Android: `IMG-20240315-WA0001.jpg (file attached)`, `… (קובץ מצורף)`. */
const ANDROID_ATTACHMENT_TAIL = /^(.*?)\s*(\S+)\s*\(([^()]{1,40})\)$/;

/**
 * Android again, taking the **whole line** as the filename. Android never puts a caption on
 * the marker line (it goes on the next one), and it keeps the names of documents and contact
 * cards as they were: `Dana Levi.vcf (file attached)`, `Q3 report (final).pdf (file attached)`.
 * Reading only the last word names a file that does not exist in the export.
 */
const ANDROID_ATTACHMENT_LINE = /^(.+\.[A-Za-z0-9]{1,8})\s\(([^()]{1,40})\)$/;

/**
 * What Android writes in the brackets after a filename, per app language. Every entry was read
 * off a real export except the last four, which are from WhatsApp's own translations.
 */
const ATTACHED_PHRASES: ReadonlySet<string> = new Set([
  "file attached",
  "קובץ מצורף",
  "файл добавлен",
  "soubor byl přiložen",
  "bestand bijgevoegd",
  "datei angehängt",
  "archivo adjunto",
  "fichier joint",
  "arquivo anexado",
  "file allegato",
]);

/**
 * Omitted-media placeholders. iOS writes these in the **app's** language, which is not always
 * the chat's: an English-language iPhone writes `image omitted` in a fully Hebrew chat. Note
 * they are unbracketed on iOS (`image omitted`) and bracketed on Android (`<Media omitted>`).
 *
 * A with-media export still contains these for media no longer present on the device, so they
 * are not merely the "exported without media" case.
 *
 * This pattern is the fallback for a file whose direction marks were lost. With the marks
 * present, an iOS media line is recognised by position in every language (`MarkerHints`).
 */
const OMITTED_TAIL =
  /^(.*?)\s*(?:<[^>]*omitted[^>]*>|<Media omitted>|(?:image|video|audio|sticker|GIF|document|contact card|video note|view once message)\s+omitted|<המדיה לא נכללה>)$/i;

/**
 * Android's placeholder in any language: the whole body is one bracketed phrase —
 * `<Media omitted>`, `<Без медиафайлов>`, `<Média vynechány>`, `<Medien ausgeschlossen>`.
 * Markup someone typed (`<div>`, `<br/>`, `<a href="…">`) is one ASCII word or carries
 * punctuation no placeholder has, and is left alone.
 */
const ANDROID_BRACKETED_BODY = /^<([^<>:="'/\\\n]{3,60})>$/;
const isBracketedPlaceholder = (body: string): boolean => {
  const inner = ANDROID_BRACKETED_BODY.exec(body)?.[1];
  return (
    inner !== undefined &&
    // Words only. `<!DOCTYPE html>` is two "words" too, and someone did send it.
    /^[\p{L}\p{M}][\p{L}\p{M}\s-]*$/u.test(inner) &&
    (/\s/.test(inner.trim()) || /[^\x00-\x7f]/.test(inner))
  );
};

/**
 * An iOS marker that is not `<attached: …>` is an "omitted" placeholder, in whatever language:
 * a few words, no sentence, no link. Everything real exports put after a media line's last
 * mark fits; the encryption notice, a location and a poll header do not.
 */
const isPlaceholderPhrase = (tail: string): boolean =>
  tail.length > 0 &&
  tail.length <= 48 &&
  !tail.includes("://") &&
  !tail.endsWith(":") &&
  !/^<[^<>]*>$/.test(tail) && // `<This message was edited>` — a tail, but not a media one
  !/[.!?]\s+\S/.test(tail);

/**
 * Bodies meaning "this message was deleted", lower-cased and without the full stop iOS adds.
 * Per-member by nature: the sender sees "You deleted this message" where everyone else sees
 * "This message was deleted", so these must never be merged as if they were the same event.
 *
 * Read off real exports in each language (the pair for a language is one chat, both sides).
 */
const DELETED_BODIES: ReadonlySet<string> = new Set([
  "this message was deleted",
  "you deleted this message",
  "הודעה זו נמחקה",
  "מחקת הודעה זו",
  "ההודעה נמחקה",
  "se eliminó este mensaje",
  "eliminaste este mensaje",
  "ce message a été supprimé",
  "vous avez supprimé ce message",
  "cette message a été supprimé",
  "diese nachricht wurde gelöscht",
  "du hast diese nachricht gelöscht",
  "questo messaggio è stato eliminato",
  "hai eliminato questo messaggio",
  "esta mensagem foi apagada",
  "apagou esta mensagem",
  "данное сообщение удалено",
  "вы удалили данное сообщение",
  "це повідомлення було видалено",
  "ви видалили це повідомлення",
  "tato zpráva byla smazána",
  "tuto zprávu jste smazal/a",
  "pesan ini dihapus",
  "anda menghapus pesan ini",
  "تم حذف هذه الرسالة",
  "أنت حذفت هذه الرسالة",
  "यह मैसेज डिलीट कर दिया गया है",
  "आपने यह मैसेज डिलीट किया",
  "このメッセージは削除されました",
  "このメッセージを削除しました",
  "ข้อความนี้ถูกลบแล้ว",
  "คุณได้ลบข้อความนี้",
  "tin nhắn này đã bị xóa",
  "bạn đã xoá tin nhắn này",
]);

/** Is this body, whole, a deleted-message tombstone? */
export function isDeletedBody(body: string): boolean {
  return DELETED_BODIES.has(body.trim().toLowerCase().replace(/[.。]$/, ""));
}

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
 * Where WhatsApp's direction marks stood on the raw line — see `text.ts`. All optional: with
 * none of them, classification falls back to wording and shape.
 */
export interface MarkerHints {
  /** iOS: the line began with a mark, before the `[`. WhatsApp's own sign for a media line. */
  readonly mediaLine?: boolean;
  /** The normalized text after the line's last mark. On a media line, the marker itself. */
  readonly markedTail?: string | undefined;
  /** The body itself began with a mark: WhatsApp wrote it, not a person. */
  readonly generated?: boolean;
  readonly platform?: "ios" | "android" | "unknown";
}

/**
 * Classify a message body that has already been separated from its header.
 * `hasSender` is false for system lines, which are never attachments.
 */
export function classifyBody(
  body: string,
  hasSender: boolean,
  hints: MarkerHints = {},
): Classification {
  const trimmed = body.trim();

  if (!hasSender) return { kind: "system" };

  if (isDeletedBody(trimmed)) return { kind: "deleted" };

  // iOS, by position: the line is marked as media and its last mark introduces the marker.
  const tail = hints.markedTail;
  if (hints.mediaLine === true && tail !== undefined && tail !== "" && trimmed.endsWith(tail)) {
    const caption = trimmed.slice(0, trimmed.length - tail.length).trim();
    const named = IOS_ATTACHMENT_MARKER.exec(tail)?.[1];
    if (named !== undefined && SPACED_FILENAME_RE.test(named)) {
      return { kind: "attachment", attachment: { filename: named }, caption };
    }
    if (named === undefined && isPlaceholderPhrase(tail)) {
      return { kind: "omitted-media", caption };
    }
  }

  const ios = IOS_ATTACHMENT_TAIL.exec(trimmed);
  if (
    ios?.[2] !== undefined &&
    // Without the marks, a name with spaces is believed only in iOS's own numbered form.
    (FILENAME_RE.test(ios[2]) || IOS_NUMBERED_FILENAME_RE.test(ios[2]))
  ) {
    return {
      kind: "attachment",
      attachment: { filename: ios[2] },
      caption: (ios[1] ?? "").trim(),
    };
  }

  if (hints.platform !== "ios") {
    const line = ANDROID_ATTACHMENT_LINE.exec(trimmed);
    // Believed on the phrase alone. A leading mark is not enough here: nothing rules out a
    // right-to-left phone marking ordinary bodies too, and `ראית את doc.pdf (הישן)` read as an
    // attachment loses the bracketed word.
    if (line?.[1] !== undefined && ATTACHED_PHRASES.has((line[2] ?? "").trim().toLowerCase())) {
      return { kind: "attachment", attachment: { filename: line[1].trim() }, caption: "" };
    }

    // An unknown app language with no mark to go by: only a filename Android itself coined is
    // taken as proof. `see report.pdf (the new one)` is something a person wrote, and reading
    // it as an attachment would drop the bracketed words from the archive.
    const android = ANDROID_ATTACHMENT_TAIL.exec(trimmed);
    if (android?.[2] !== undefined && ANDROID_WA_FILENAME_RE.test(android[2])) {
      return {
        kind: "attachment",
        attachment: { filename: android[2] },
        caption: (android[1] ?? "").trim(),
      };
    }

    if (isBracketedPlaceholder(trimmed)) return { kind: "omitted-media", caption: "" };
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

/**
 * Notices WhatsApp writes *under a sender's name*: in a 1:1 chat the contact's, in an iOS group
 * the group's own. They are not something anyone said, and WhatsApp shows them as a centred
 * line, not a bubble.
 *
 * Matched by how they open, because the rest varies by version ("Tap to learn more", "Only
 * people in this chat can read…"). The stored message keeps its sender and its `text` kind —
 * reclassifying it would change its id and duplicate it in every archive that already has it —
 * so this is asked at display time (`present.ts`) and when listing participants.
 */
const NOTICE_OPENINGS: readonly RegExp[] = [
  /^messages (and calls|to this (chat|group)) (are|is) (now )?(end-to-end encrypted|secured)/i,
  /^your security code with .{1,80} changed/i,
  // Only with the sentence WhatsApp always adds: "I turned on disappearing messages" alone is
  // something a person might say.
  /^.{1,60} (updated the message timer|turned (on|off) disappearing messages)\. \S/i,
  /^disappearing messages (were|are) turned (on|off)/i,
  /^this chat is with a business account/i,
  /^this business (uses|works with|is now)/i,
  /^you (blocked|unblocked) this (contact|business)/i,
  /^ה?הודעות וה?שיחות מוצפנות מקצה[- ]לקצה/,
  /^קוד האבטחה (שלך )?(עם|של) /,
  /^(חסמת את|ביטלת את חסימת) איש הקשר/,
  /^nachrichten und anrufe sind ende-zu-ende-verschlüsselt/i,
  /^les messages et les appels sont chiffrés de bout en bout/i,
  /^los mensajes y las llamadas están cifrados de extremo a extremo/i,
  /^i messaggi e le chiamate sono crittografati end-to-end/i,
  /^as mensagens e (as )?chamadas são (encriptadas ponto a ponto|protegidas com a criptografia)/i,
  /^сообщения и звонки защищены сквозным шифрованием/i,
  /^повідомлення й дзвінки захищено наскрізним шифруванням/i,
  /^zprávy a hovory jsou (opatřeny|zabezpečeny) koncovým šifrováním/i,
  /^pesan dan panggilan terenkripsi secara end-to-end/i,
  /^berichten en oproepen worden end-to-end versleuteld/i,
];

/** Is this body one of WhatsApp's own notices rather than something its sender wrote? */
export function looksLikeNotice(body: string): boolean {
  const opening = body.trimStart().slice(0, 200);
  return NOTICE_OPENINGS.some((re) => re.test(opening));
}
