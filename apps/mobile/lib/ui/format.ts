/**
 * Number and date formatting for the screens.
 *
 * Pure, and therefore tested (`format.test.ts`) — which is worth doing precisely because these
 * look too trivial to get wrong. The Verify screen's whole job is to be believed, and a date
 * range printed a day out, or a byte count rounded to "0 MB", undermines it more effectively
 * than a bug in the parser would: the user can *see* these.
 */

/** Bytes, at a precision that never rounds a real file down to nothing. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Thousands separators, because "40000 messages" is harder to read than "40,000". */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** `14 Mar 2025`. Local time: the archive's timestamps are the phone's own wall clock. */
export function formatDate(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return "-";
  const date = new Date(epochMs);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return "-";
  const date = new Date(epochMs);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(epochMs)}, ${hh}:${mm}`;
}

/**
 * A date range as one phrase. Collapses to a single date when both ends fall on one day —
 * "14 Mar 2025 to 14 Mar 2025" reads like a formatting bug rather than a one-day chat.
 */
export function formatRange(firstTs: number, lastTs: number): string {
  if (firstTs <= 0 || lastTs <= 0) return "-";
  const first = formatDate(firstTs);
  const last = formatDate(lastTs);
  return first === last ? first : `${first} — ${last}`;
}

/** `3 photos`, `1 photo`. Plurals matter when the number is the point of the sentence. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
