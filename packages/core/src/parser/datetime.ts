import type { DateOrder } from "../types.js";

/**
 * Date/time parsing for export headers.
 *
 * Exports carry no timezone and no locale declaration, so both the field order (`03/04` is
 * April 3rd in most of the world and March 4th in the US) and the clock convention have to be
 * *inferred from the file as a whole*. Guessing per-line is how archives end up silently
 * off by months.
 */

export interface DateTimeTokens {
  /** The three date fields in the order they appeared. Meaning not yet assigned. */
  readonly fields: readonly [number, number, number];
  readonly hour: number;
  readonly minute: number;
  readonly second: number | null;
  readonly meridiem: "am" | "pm" | null;
}

export interface ResolvedDateTime {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-31
  readonly hour: number; // 0-23
  readonly minute: number;
  readonly second: number;
  /** `YYYY-MM-DDTHH:mm:ss`, exactly as printed, with no zone attached. */
  readonly wallClock: string;
}

/**
 * Meridiem markers across the locales WhatsApp ships. Hebrew and most European locales use a
 * 24-hour clock and appear here only for completeness.
 */
const MERIDIEM: ReadonlyMap<string, "am" | "pm"> = new Map([
  ["am", "am"],
  ["a.m.", "am"],
  ["a. m.", "am"],
  ["pm", "pm"],
  ["p.m.", "pm"],
  ["p. m.", "pm"],
  ["ص", "am"], // Arabic
  ["م", "pm"],
  ["পূ", "am"], // Bengali
  ["ਪੂ", "pm"],
]);

const DATETIME_RE = new RegExp(
  "^\\s*(\\d{1,4})[./-](\\d{1,2})[./-](\\d{2,4})" + // date fields
    "[,\\s]+" +
    "(\\d{1,2}):(\\d{2})(?::(\\d{2}))?" + // time
    "\\s*(\\S{1,4}\\.?\\s?\\S{0,2}\\.?)?\\s*$", // optional meridiem
);

/**
 * Pull the numeric shape out of a header's datetime portion. Returns `null` if the string
 * is not a datetime at all — which is the normal signal that a line is a continuation of the
 * previous message rather than a new one.
 */
export function tokenizeDateTime(input: string): DateTimeTokens | null {
  const m = DATETIME_RE.exec(input);
  if (!m) return null;

  const [, f1, f2, f3, h, min, sec, mer] = m;
  if (!f1 || !f2 || !f3 || !h || !min) return null;

  let meridiem: "am" | "pm" | null = null;
  if (mer !== undefined && mer.trim() !== "") {
    const key = mer.trim().toLowerCase().replace(/\s+/g, " ");
    const found = MERIDIEM.get(key);
    // An unrecognised trailing token means this isn't a datetime we understand. Bail rather
    // than silently dropping it and producing a wrong time.
    if (!found) return null;
    meridiem = found;
  }

  return {
    fields: [Number(f1), Number(f2), Number(f3)],
    hour: Number(h),
    minute: Number(min),
    second: sec === undefined ? null : Number(sec),
    meridiem,
  };
}

/**
 * Decide the date field order for a whole file.
 *
 * Evidence beats default: a field above 12 somewhere in the file can only be a day, and a
 * first field above 31 can only be a year. Only when a file is genuinely ambiguous (every
 * date in the first twelve days of its month) do we fall back to `fallback`.
 */
export function inferDateOrder(
  samples: readonly DateTimeTokens[],
  fallback: DateOrder = "DMY",
): DateOrder {
  let firstOverTwelve = 0;
  let secondOverTwelve = 0;
  let firstOverThirtyOne = 0;

  for (const t of samples) {
    const [a, b] = t.fields;
    if (a > 31) firstOverThirtyOne++;
    else if (a > 12) firstOverTwelve++;
    if (b > 12) secondOverTwelve++;
  }

  if (firstOverThirtyOne > 0) return "YMD";
  // These two are mutually exclusive in a well-formed file; if both fire the file is mixed,
  // and the more frequent signal wins.
  if (firstOverTwelve > secondOverTwelve) return "DMY";
  if (secondOverTwelve > firstOverTwelve) return "MDY";
  return fallback;
}

/** Whether any sample used a 12-hour clock. */
export function inferClock(samples: readonly DateTimeTokens[]): "12h" | "24h" {
  return samples.some((s) => s.meridiem !== null) ? "12h" : "24h";
}

/** Whether the file prints seconds (iOS does, Android generally does not). */
export function inferHasSeconds(samples: readonly DateTimeTokens[]): boolean {
  return samples.some((s) => s.second !== null);
}

function expandYear(y: number): number {
  if (y >= 100) return y;
  // WhatsApp has not existed before 2009, so a two-digit year is unambiguously 20xx.
  return 2000 + y;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeap(year)) return 29;
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

/**
 * Assign meaning to the tokens under a known field order and validate the result. Returns
 * `null` for impossible dates (month 13, February 30th) rather than rolling over the way
 * `new Date()` would — a silently rolled-over date is worse than a rejected line.
 */
export function resolveDateTime(
  tokens: DateTimeTokens,
  order: DateOrder,
): ResolvedDateTime | null {
  const [a, b, c] = tokens.fields;

  let year: number;
  let month: number;
  let day: number;
  switch (order) {
    case "DMY":
      [day, month, year] = [a, b, expandYear(c)];
      break;
    case "MDY":
      [month, day, year] = [a, b, expandYear(c)];
      break;
    case "YMD":
      [year, month, day] = [expandYear(a), b, c];
      break;
  }

  let hour = tokens.hour;
  if (tokens.meridiem === "pm") hour = (hour % 12) + 12;
  else if (tokens.meridiem === "am") hour = hour % 12;

  const second = tokens.second ?? 0;

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || tokens.minute > 59 || second > 59) return null;
  if (year < 2009 || year > 2100) return null;

  return {
    year,
    month,
    day,
    hour,
    minute: tokens.minute,
    second,
    wallClock:
      `${pad(year, 4)}-${pad(month)}-${pad(day)}` +
      `T${pad(hour)}:${pad(tokens.minute)}:${pad(second)}`,
  };
}

/**
 * Turn a wall-clock into epoch ms under an assumed UTC offset. Computed arithmetically via
 * `Date.UTC` so the result never depends on the machine's own timezone — the same export must
 * parse identically on a phone in Tel Aviv and a CI runner in UTC.
 */
export function wallClockToEpoch(dt: ResolvedDateTime, offsetMinutes: number): number {
  return (
    Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second) -
    offsetMinutes * 60_000
  );
}
