/**
 * Number and date formatting for the screens.
 *
 * Pure, and therefore tested (`format.test.ts`) — which is worth doing precisely because these
 * look too trivial to get wrong. The Verify screen's whole job is to be believed, and a date
 * range printed a day out, or a byte count rounded to "0 MB", undermines it more effectively
 * than a bug in the parser would: the user can *see* these.
 *
 * **The current language is module state, not a parameter.** These are called from dozens of
 * places, several of them outside React, and threading a language through every call site would
 * have meant touching every screen twice. `setFormatLanguage` is called once by `AppProvider`
 * when the setting changes. The default is English, so the existing tests — which assert
 * English month names — stay honest without knowing this exists, and each function still takes
 * an explicit override for the tests that check the Hebrew side.
 */

import type { Language } from "../settings/settings";

let current: Language = "en";

export function setFormatLanguage(language: Language): void {
  current = language;
}

/** Bytes, at a precision that never rounds a real file down to nothing. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Thousands separators, because "40000 messages" is harder to read than "40,000".
 *
 * Hebrew uses Western digits and the same comma grouping, so this is deliberately not switched
 * per language: `he-IL` and `en-US` produce identical output here, and pinning one locale keeps
 * the number identical between the two languages — which matters, because these numbers are
 * evidence a user may compare across a language change.
 */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

const MONTHS: Record<Language, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  // Transliterated Gregorian months, which is what Hebrew speakers use for civil dates. The
  // Hebrew calendar is not involved: these timestamps come from WhatsApp and are Gregorian.
  he: [
    "ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני",
    "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳",
  ],
};

/** `14 Mar 2025`. Local time: the archive's timestamps are the phone's own wall clock. */
export function formatDate(epochMs: number, language: Language = current): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return "-";
  const date = new Date(epochMs);
  return `${date.getDate()} ${MONTHS[language][date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(epochMs: number, language: Language = current): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return "-";
  const date = new Date(epochMs);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(epochMs, language)}, ${hh}:${mm}`;
}

/**
 * A date range as one phrase. Collapses to a single date when both ends fall on one day —
 * "14 Mar 2025 to 14 Mar 2025" reads like a formatting bug rather than a one-day chat.
 */
export function formatRange(
  firstTs: number,
  lastTs: number,
  language: Language = current,
): string {
  if (firstTs <= 0 || lastTs <= 0) return "-";
  const first = formatDate(firstTs, language);
  const last = formatDate(lastTs, language);
  return first === last ? first : `${first} — ${last}`;
}

/** `3 photos`, `1 photo`. Plurals matter when the number is the point of the sentence. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
