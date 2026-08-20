/**
 * Text normalization.
 *
 * WhatsApp exports are littered with invisible characters. iOS in particular emits a
 * LEFT-TO-RIGHT MARK before nearly every header and before every attachment marker, and uses
 * a NARROW NO-BREAK SPACE before AM/PM. Hebrew and Arabic exports additionally carry
 * RIGHT-TO-LEFT MARKs and directional isolates *inside* message bodies.
 *
 * Getting this wrong is the single most common cause of a chat parsing as zero messages, so
 * it happens once, up front, before any regex ever sees the text.
 *
 * The character classes are built from numeric code points rather than written as literals.
 * A literal zero-width character inside a regex is invisible in every editor and diff tool,
 * which makes it unreviewable and trivially lost to a stray copy-paste.
 */

/** `\uXXXX` as two source characters, so no invisible byte ever enters this file. */
const esc = (cp: number): string => "\\u" + cp.toString(16).padStart(4, "0");

const range = (from: number, to: number): string => esc(from) + "-" + esc(to);

/**
 * Zero-width and directional controls: no textual meaning, safe to delete outright.
 *
 * Note what is deliberately *absent*: ZWJ (U+200D) and ZWNJ (U+200C). Those are content, not
 * formatting. ZWJ is what binds an emoji sequence together — strip it and the family emoji
 * becomes four separate people — and ZWNJ changes word meaning in Persian and Arabic. Only
 * LRM/RLM are noise WhatsApp injects, so the range stops short of them.
 */
const INVISIBLE_PARTS = [
  esc(0x200b), // zero-width space
  range(0x200e, 0x200f), // LRM, RLM — the marks WhatsApp actually emits
  range(0x202a, 0x202e), // LRE, RLE, PDF, LRO, RLO
  range(0x2060, 0x2064), // word joiner + invisible math operators
  range(0x2066, 0x2069), // LRI, RLI, FSI, PDI (directional isolates)
  esc(0x00ad), // soft hyphen
  esc(0xfeff), // BOM / zero-width no-break space
];

/** Space-like characters that must survive as an ordinary space, not vanish. */
const SPACE_PARTS = [
  esc(0x00a0), // no-break space
  range(0x2000, 0x200a), // en/em quad through hair space
  esc(0x202f), // narrow no-break space — iOS puts this before AM/PM
  esc(0x205f), // medium mathematical space
  esc(0x3000), // ideographic space
];

const INVISIBLE_FORMATTING = new RegExp("[" + INVISIBLE_PARTS.join("") + "]", "g");
const EXOTIC_SPACES = new RegExp("[" + SPACE_PARTS.join("") + "]", "g");

/**
 * Strip directional controls and fold exotic spaces. Applied to the whole file before
 * splitting into lines, and safe to apply repeatedly (idempotent).
 */
export function normalizeInvisibles(input: string): string {
  return input.replace(INVISIBLE_FORMATTING, "").replace(EXOTIC_SPACES, " ");
}

/**
 * Full normalization for a raw export file: strip the BOM, unify line endings, remove
 * invisibles. Deliberately does *not* trim message bodies — leading whitespace inside a
 * multi-line message is content.
 */
export function normalizeExportText(raw: string): string {
  return normalizeInvisibles(raw).replace(/\r\n?/g, "\n");
}

/**
 * Canonical form used for identity hashing only — never for display. Collapses runs of
 * whitespace and trims, so that two members whose exports differ only in trailing spaces
 * still agree on a message's identity.
 */
export function canonicalizeForHash(input: string): string {
  return normalizeInvisibles(input).replace(/\s+/g, " ").trim();
}

/** Split normalized text into lines, dropping a single trailing empty line. */
export function toLines(normalized: string): string[] {
  const lines = normalized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
