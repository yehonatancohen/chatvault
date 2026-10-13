import type { DateOrder } from "../types.js";
import { asciiDigits } from "./text.js";

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
  /** The time was printed before the date (`[14:56:01, 3/18/22]`) — a Vietnamese-language phone. */
  readonly timeFirst: boolean;
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
 * Meridiem markers, as each locale's WhatsApp prints them. Most of the world uses a 24-hour
 * clock and never reaches this table.
 */
const MERIDIEM: ReadonlyMap<string, "am" | "pm"> = new Map([
  ["am", "am"],
  ["a.m.", "am"],
  ["a. m.", "am"],
  ["a.m", "am"],
  ["pm", "pm"],
  ["p.m.", "pm"],
  ["p. m.", "pm"],
  ["p.m", "pm"],
  ["ص", "am"], // Arabic
  ["م", "pm"],
  ["পূ", "am"], // Bengali
  ["ਪੂ", "pm"],
  ["לפנה״צ", "am"], // Hebrew, with a gershayim or the ASCII quote keyboards produce
  ["אחה״צ", "pm"],
  ['לפנה"צ', "am"],
  ['אחה"צ', "pm"],
  ["上午", "am"], // Chinese
  ["下午", "pm"],
  ["午前", "am"], // Japanese
  ["午後", "pm"],
  ["오전", "am"], // Korean
  ["오후", "pm"],
  ["öö", "am"], // Turkish
  ["ös", "pm"],
  ["π.μ.", "am"], // Greek
  ["μ.μ.", "pm"],
  // English (UK and India) Android spells the part of the day out.
  ["in the morning", "am"],
  ["in the afternoon", "pm"],
  ["in the evening", "pm"],
  ["noon", "pm"],
  ["midnight", "am"],
]);

/** Words some locales put between the date and the time. They carry no information. */
const FILLER: ReadonlySet<string> = new Set(["klo", "kl", "kl.", "at", "um", "à", "a las", "às"]);

const DATE = "(\\d{1,4})[./-](\\d{1,2})[./-](\\d{2,4}|[A-Za-z]\\d{1,2})(\\s?BE)?";
const TIME = "(\\d{1,2})[:.](\\d{2})(?:[:.](\\d{2}))?";

/** `date, [word] time [word]` — every locale but one. */
const DATE_FIRST = new RegExp(
  "^\\s*" + DATE + "[,\\s]+(?:([^\\d\\s,][^\\d,]{0,8}?)\\s*)?" + TIME + "\\s*(\\D.{0,20}?)?\\s*$",
);
/** `time, date` — Vietnamese. */
const TIME_FIRST = new RegExp("^\\s*" + TIME + "\\s*([^\\d,][^,]{0,20}?)?\\s*,\\s*" + DATE + "\\s*$");

/** Japanese era letters as iOS prints them (`R4` is 2022), with the year before each era's first. */
const ERA_BASE: Readonly<Record<string, number>> = { R: 2018, H: 1988, S: 1925 };

/**
 * A year field as a Gregorian number. A phone set to the Buddhist calendar prints `2565 BE`
 * (or just `2565`), one set to the Japanese calendar prints `R4`; both are the year 2022.
 */
function yearField(raw: string, buddhist: boolean): number | null {
  const era = /^([A-Za-z])(\d{1,2})$/.exec(raw);
  if (era) {
    const base = ERA_BASE[(era[1] ?? "").toUpperCase()];
    return base === undefined ? null : base + Number(era[2]);
  }
  const n = Number(raw);
  return buddhist || n >= 2400 ? n - 543 : n;
}

/** Which half of the day a word names, `null` for a filler word, `undefined` if unknown. */
function meridiemOf(word: string | undefined, hour: number): "am" | "pm" | null | undefined {
  if (word === undefined || word.trim() === "") return null;
  const key = word.trim().toLowerCase().replace(/\s+/g, " ");
  if (FILLER.has(key)) return null;
  // "11:30 at night" is 23:30 and "2:10 at night" is 02:10.
  if (key === "at night") return hour >= 6 && hour < 12 ? "pm" : "am";
  return MERIDIEM.get(key);
}

/**
 * Pull the numeric shape out of a header's datetime portion. Returns `null` if the string
 * is not a datetime at all — which is the normal signal that a line is a continuation of the
 * previous message rather than a new one.
 */
export function tokenizeDateTime(input: string): DateTimeTokens | null {
  // Digits of other scripts and the Arabic comma, in the header only.
  const text = asciiDigits(input).replace(/\u060c/g, ",");

  let f1: string | undefined, f2: string | undefined, f3: string | undefined;
  let be: string | undefined, h: string | undefined, min: string | undefined;
  let sec: string | undefined, before: string | undefined, after: string | undefined;

  const dateFirst = DATE_FIRST.exec(text);
  if (dateFirst) {
    [, f1, f2, f3, be, before, h, min, sec, after] = dateFirst;
  } else {
    const timeFirst = TIME_FIRST.exec(text);
    if (!timeFirst) return null;
    [, h, min, sec, after, f1, f2, f3, be] = timeFirst;
  }
  if (!f1 || !f2 || !f3 || !h || !min) return null;

  const hour = Number(h);
  const pre = meridiemOf(before, hour);
  const post = meridiemOf(after, hour);
  // An unrecognised word means this isn't a datetime we understand. Bail rather than silently
  // dropping it and producing a wrong time.
  if (pre === undefined || post === undefined) return null;

  const first = yearField(f1, false);
  const third = yearField(f3, be !== undefined);
  if (first === null || third === null) return null;

  return {
    fields: [first, Number(f2), third],
    hour,
    minute: Number(min),
    second: sec === undefined ? null : Number(sec),
    meridiem: pre ?? post,
    timeFirst: dateFirst === null,
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
