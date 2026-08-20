/**
 * Hand-authored export fixtures, one per dialect we claim to support.
 *
 * These are written by hand and contain no real chat data — root CLAUDE.md invariant 6. Real
 * exports contain other people's personal data and must never enter the repo.
 *
 * The invisible characters WhatsApp emits are injected programmatically via `LRM`/`NNBSP`
 * rather than pasted in, so a reviewer can see exactly where they are.
 */

/** LEFT-TO-RIGHT MARK — iOS prefixes headers and attachment markers with this. */
const LRM = String.fromCharCode(0x200e);
/** RIGHT-TO-LEFT MARK — appears throughout Hebrew and Arabic exports. */
const RLM = String.fromCharCode(0x200f);
/** NARROW NO-BREAK SPACE — iOS uses this, not a plain space, before AM/PM. */
const NNBSP = String.fromCharCode(0x202f);

/** Android, UK/EU locale: `DD/MM/YYYY, HH:mm - Sender: body`, 24-hour, no seconds. */
export const ANDROID_EN_24H = [
  "15/03/2024, 09:04 - Messages and calls are end-to-end encrypted.",
  "15/03/2024, 09:05 - Dana: Morning! Are we still on for Saturday?",
  "15/03/2024, 09:06 - Ravid: Yes — I'll bring the tent",
  "15/03/2024, 09:07 - Dana: IMG-20240315-WA0001.jpg (file attached)",
  "15/03/2024, 09:07 - Dana: That's the campsite",
  "20/03/2024, 22:41 - Ravid: This message was deleted",
].join("\n");

/** iOS, UK/EU locale: bracketed header with seconds, LRM before every line. */
export const IOS_EN_24H = [
  `${LRM}[15/03/2024, 09:05:12] Dana: Morning! Are we still on for Saturday?`,
  `${LRM}[15/03/2024, 09:06:33] Ravid: Yes — I'll bring the tent`,
  `${LRM}[15/03/2024, 09:07:02] Dana: ${LRM}<attached: 00000042-PHOTO-2024-03-15-09-07-02.jpg>`,
  `${LRM}[15/03/2024, 09:07:40] Dana: That's the campsite`,
].join("\n");

/** iOS, US locale: `M/D/YY, h:mm:ss AM` with a narrow no-break space before the meridiem. */
export const IOS_US_12H = [
  `${LRM}[3/15/24, 9:05:12${NNBSP}AM] Dana: Morning! Are we still on for Saturday?`,
  `${LRM}[3/15/24, 2:06:33${NNBSP}PM] Ravid: Yes — I'll bring the tent`,
  `${LRM}[12/25/24, 11:59:00${NNBSP}PM] Dana: Happy holidays`,
].join("\n");

/** Android, Hebrew locale: dot-separated dates, RTL marks inside bodies, localized markers. */
export const ANDROID_HE = [
  `15.3.2024, 9:04 - ${RLM}ההודעות והשיחות מוצפנות מקצה לקצה.`,
  `15.3.2024, 9:05 - דנה: ${RLM}בוקר טוב! אנחנו עדיין בעניין של שבת?`,
  `15.3.2024, 9:06 - רביד: ${RLM}כן, אני מביא את האוהל`,
  `15.3.2024, 9:07 - דנה: IMG-20240315-WA0001.jpg (קובץ מצורף)`,
  `20.3.2024, 22:41 - רביד: ${RLM}הודעה זו נמחקה`,
].join("\n");

/** Multi-line bodies, including blank lines and a line that starts with a digit. */
export const MULTILINE = [
  "15/03/2024, 09:05 - Dana: Here's the packing list:",
  "1. Tent",
  "2. Stove",
  "",
  "3. Coffee — non-negotiable",
  "15/03/2024, 09:06 - Ravid: Noted",
].join("\n");

/**
 * Every date falls in the first twelve days of its month, so day/month order is genuinely
 * undecidable from the content. Used to prove we fall back rather than guess confidently.
 */
export const AMBIGUOUS_DATES = [
  "05/03/2024, 09:05 - Dana: one",
  "06/03/2024, 09:06 - Ravid: two",
].join("\n");

/**
 * The same conversation as ANDROID_EN_24H, exported by a different member who chose
 * "without media" and whose device shows Dana by phone number. Used to exercise merge.
 */
export const ANDROID_EN_24H_OTHER_MEMBER = [
  "15/03/2024, 09:05 - Dana: Morning! Are we still on for Saturday?",
  "15/03/2024, 09:06 - Ravid: Yes — I'll bring the tent",
  "15/03/2024, 09:07 - Dana: <Media omitted>",
  "15/03/2024, 09:07 - Dana: That's the campsite",
  "22/03/2024, 08:15 - Ravid: Anyone still awake?",
].join("\n");

/**
 * Captioned media — how WhatsApp actually emits a photo with a caption. The caption is a
 * *continuation line of the same message*, not a message of its own.
 *
 * This shape is why classification runs on the first line rather than the joined body: a
 * parser that classifies the whole body sees neither an attachment marker nor omitted media,
 * demotes the message to plain text, and loses the file reference entirely.
 */
export const CAPTIONED_ANDROID = [
  "15/03/2024, 09:07 - Dana: IMG-20240315-WA0001.jpg (file attached)",
  "That's the campsite",
  "15/03/2024, 09:08 - Ravid: Looks good",
].join("\n");

export const CAPTIONED_IOS = [
  `${LRM}[15/03/2024, 09:07:02] Dana: ${LRM}<attached: 00000042-PHOTO-2024-03-15-09-07-02.jpg>`,
  "That's the campsite",
  `${LRM}[15/03/2024, 09:08:11] Ravid: Looks good`,
].join("\n");

/**
 * ⚠️ HYPOTHETICAL SHAPE. Kept only to prove the parser tolerates a caption arriving as a
 * continuation line. Real iOS exports do **not** do this — see `IOS_REAL_*` below, which are
 * modelled on an actual export pair and are the fixtures that matter.
 */
export const CAPTIONED_ANDROID_NO_MEDIA = [
  "15/03/2024, 09:07 - Dana: <Media omitted>",
  "That's the campsite",
  "15/03/2024, 09:08 - Ravid: Looks good",
].join("\n");

/** Media with no caption — the marker line is the entire message. */
export const BARE_MEDIA_ANDROID = [
  "15/03/2024, 09:07 - Dana: <Media omitted>",
  "15/03/2024, 09:08 - Ravid: Looks good",
].join("\n");

/**
 * Ordinary messages whose bodies contain the verbs that appear in system events. Every one of
 * these is a real message from a real sender, and a system-detection pattern loose enough to
 * match across the `Sender: ` prefix turns them all into senderless system messages.
 */
export const SYSTEM_VERB_LOOKALIKES = [
  "15/03/2024, 09:05 - Dana: I left my keys at home",
  "15/03/2024, 09:06 - Ravid: I changed my mind about the tent",
  "15/03/2024, 09:07 - Dana: Who added the extra bag?",
  "15/03/2024, 09:08 - Ravid: She joined us last year too",
  "15/03/2024, 09:09 - Dana: I deleted the old list",
  "15/03/2024, 09:10 - Ravid: They removed the campsite booking",
].join("\n");

/** Genuine system events, which never carry a `Sender: ` prefix. */
export const SYSTEM_EVENTS = [
  "15/03/2024, 09:00 - Messages and calls are end-to-end encrypted.",
  "15/03/2024, 09:01 - Dana created group \"Camping\"",
  "15/03/2024, 09:02 - Ravid joined using this group's invite link",
  "15/03/2024, 09:03 - You changed the group name to: Camping 2024",
].join("\n");

/**
 * Content that must survive normalization untouched. Built from code points for the same
 * reason the stripping rules are — a literal ZWJ here would be indistinguishable from its
 * absence, and this fixture exists precisely to prove the ZWJ is still there.
 */
const ZWJ = String.fromCharCode(0x200d);
const ZWNJ = String.fromCharCode(0x200c);

/** Family emoji: four people bound by ZWJ. Strip the joiners and it becomes four emoji. */
export const FAMILY_EMOJI = [0x1f468, 0x1f469, 0x1f467, 0x1f466]
  .map((cp) => String.fromCodePoint(cp))
  .join(ZWJ);

/** Persian "mi-ravam": the ZWNJ is orthographic, not formatting. */
export const PERSIAN_ZWNJ = `می${ZWNJ}روم`;

export const EMOJI_AND_ZWNJ = [
  `15/03/2024, 09:05 - Dana: ${FAMILY_EMOJI} all packed`,
  `15/03/2024, 09:06 - Ravid: ${PERSIAN_ZWNJ}`,
].join("\n");

/* ------------------------------------------------------------------------------------------
 * Fixtures modelled on a REAL iOS export pair
 *
 * Derived from one Hebrew 1:1 chat exported twice from the same phone minutes apart, once
 * with media and once without. Content is replaced with invented Hebrew and the senders are
 * renamed; only the *structure* is real. No message from the source chat appears here — root
 * CLAUDE.md invariant 6.
 *
 * What the real pair established, all of which contradicted earlier guesses:
 *
 * 1. A caption is **inline, before the marker, on the same line** — `Sender: caption ‎<marker>`
 *    — not a continuation line. The marker is always last and always preceded by an LRM.
 * 2. iOS writes the omitted markers in **English** ("image omitted", "video omitted",
 *    "sticker omitted") even in a fully Hebrew chat.
 * 3. A *with-media* export still contains omitted markers for media no longer on the device.
 *    In the source pair, 6 of 21 media messages were omitted even in the with-media export.
 * 4. The two exports disagreed about the **seconds** on 8 of 127 timestamps — the same message,
 *    same phone, minutes apart. This is the evidence behind minute-precision identity.
 * 5. In a 1:1 chat the end-to-end-encryption notice carries the other participant's name as a
 *    sender prefix, so it is not distinguishable by the absence of a sender.
 * ---------------------------------------------------------------------------------------- */

/** With-media export. Note the LRM immediately before every marker. */
export const IOS_REAL_WITH_MEDIA = [
  `${LRM}[22/02/2025, 17:12:39] נועה: ${LRM}Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.`,
  `${LRM}[22/02/2025, 17:12:39] נועה: ${LRM}<attached: 00000012-VIDEO-2025-02-22-17-12-39.mp4>`,
  `[22/02/2025, 18:41:16] אורי: 💪🏻💪🏻`,
  `${LRM}[14/03/2025, 20:10:35] אורי: תראה מה מצאתי ${LRM}<attached: 00000043-PHOTO-2025-03-14-20-10-34.jpg>`,
  `[14/03/2025, 20:15:59] נועה: ואו יפה מאוד`,
  `${LRM}[15/03/2025, 15:48:45] אורי: ${LRM}<attached: 00000049-STICKER-2025-03-15-15-48-45.webp>`,
  `${LRM}[22/03/2025, 17:47:34] נועה: ${LRM}image omitted`,
  `[22/03/2025, 18:58:22] אורי: מסכים איתך`,
  `[23/03/2025, 09:14:02] נועה: שורה ראשונה`,
  `שורה שנייה של אותה הודעה`,
].join("\n");

/** The same chat, exported without media. Same messages, markers replaced, seconds drift. */
export const IOS_REAL_WITHOUT_MEDIA = [
  `${LRM}[22/02/2025, 17:12:39] נועה: ${LRM}Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.`,
  `${LRM}[22/02/2025, 17:12:39] נועה: ${LRM}video omitted`,
  `[22/02/2025, 18:41:16] אורי: 💪🏻💪🏻`,
  // Same message as the with-media export, one second earlier — real, observed drift.
  `${LRM}[14/03/2025, 20:10:34] אורי: תראה מה מצאתי ${LRM}image omitted`,
  `[14/03/2025, 20:15:59] נועה: ואו יפה מאוד`,
  `${LRM}[15/03/2025, 15:48:45] אורי: ${LRM}sticker omitted`,
  `${LRM}[22/03/2025, 17:47:34] נועה: ${LRM}image omitted`,
  `[22/03/2025, 18:58:22] אורי: מסכים איתך`,
  `[23/03/2025, 09:14:02] נועה: שורה ראשונה`,
  `שורה שנייה של אותה הודעה`,
].join("\n");
