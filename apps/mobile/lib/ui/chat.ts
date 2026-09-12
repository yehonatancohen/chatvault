/**
 * Turning a flat message list into the shape a chat is actually read in.
 *
 * Three things every messaging app does and a bare list does not: a date separator when the day
 * changes, consecutive messages from one person grouped under a single name, and the newest
 * message at the bottom. The first two are computed here so they can be tested; the third is
 * the list's job (`FlatList inverted`), which is why `forInvertedList` exists.
 *
 * Grouping is by sender *and* by time. Two messages from the same person twelve hours apart are
 * not one utterance, and stacking them under one name reads as though the second arrived right
 * after the first — which, in an archive someone is checking against their memory of a
 * conversation, is a small lie about when things were said.
 */

import type { MergedMessage } from "@chatvault/core";
import type { Language } from "../settings/settings";

/** Beyond this gap, the same sender starts a new group even on the same day. */
export const GROUP_GAP_MS = 5 * 60 * 1000;

export type ChatRow =
  | { readonly kind: "day"; readonly key: string; readonly ts: number }
  | {
      readonly kind: "message";
      readonly key: string;
      readonly message: MergedMessage;
      /** First of a run by one sender: the row that carries the name. */
      readonly startsGroup: boolean;
      /** Last of a run: the row that carries the timestamp and the tail. */
      readonly endsGroup: boolean;
    };

export function buildChatRows(messages: readonly MergedMessage[]): ChatRow[] {
  const rows: ChatRow[] = [];
  // The id alone is not safe as a key: identity is content-derived, so a person sending the
  // same word twice in one minute produces two messages with one id. Counting each id's
  // occurrences **from the end** disambiguates them without using the array position, which
  // matters because the web viewer loads the newest chunk first and prepends the rest: keyed
  // by position, every existing row would be re-keyed on each prepend and the whole list would
  // remount under the reader's finger.
  const seen = new Map<string, number>();
  const suffixes = new Array<number>(messages.length);
  for (let i = messages.length - 1; i >= 0; i--) {
    const count = seen.get(messages[i]!.id) ?? 0;
    suffixes[i] = count;
    seen.set(messages[i]!.id, count + 1);
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]!;
    const previous = messages[i - 1];
    const next = messages[i + 1];

    if (previous === undefined || !sameDay(previous.ts, message.ts)) {
      // A day's first message fixes the separator's identity; no two days can share it.
      rows.push({ kind: "day", key: `day-${message.ts}`, ts: message.ts });
    }

    rows.push({
      kind: "message",
      key: `${message.id}~${suffixes[i]!}`,
      message,
      startsGroup: !continues(previous, message),
      endsGroup: !continues(message, next),
    });
  }

  return rows;
}

/**
 * The same rows, ordered for a `FlatList` with `inverted`.
 *
 * An inverted list renders index 0 at the bottom, so the newest message must come first. This
 * is preferred over scrolling a normal list to the end because it makes "open at the bottom"
 * the resting state rather than a scroll that happens after layout — which is what produces
 * the flash of the oldest message that every home-grown chat screen has.
 */
export function forInvertedList(rows: readonly ChatRow[]): ChatRow[] {
  return [...rows].reverse();
}

/** Whether `later` continues a run started by `earlier`. */
function continues(earlier: MergedMessage | undefined, later: MergedMessage | undefined): boolean {
  if (!earlier || !later) return false;
  // System notices stand alone: they belong to the conversation, not to a speaker's turn.
  if (earlier.kind === "system" || later.kind === "system") return false;
  if (earlier.sender === null || later.sender === null) return false;
  if (earlier.sender !== later.sender) return false;
  if (!sameDay(earlier.ts, later.ts)) return false;
  return later.ts - earlier.ts <= GROUP_GAP_MS;
}

/** Whole days from `earlier` to `later`, counting by date rather than by duration. */
function calendarDaysBetween(earlier: number, later: number): number {
  const startOfDay = (ts: number): number => {
    const date = new Date(ts);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  return Math.round((startOfDay(later) - startOfDay(earlier)) / (24 * 60 * 60 * 1000));
}

export function sameDay(a: number, b: number): boolean {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

const DAY_NAMES: Record<Language, readonly string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  // Hebrew names its weekdays by number — יום ראשון is Sunday — except Saturday, which has a
  // name. `שבת` rather than `יום שביעי` for that reason; nobody says the latter.
  he: ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"],
};

const RELATIVE: Record<Language, { today: string; yesterday: string }> = {
  en: { today: "Today", yesterday: "Yesterday" },
  he: { today: "היום", yesterday: "אתמול" },
};

const FULL_MONTHS: Record<Language, readonly string[]> = {
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  he: [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ],
};

/**
 * `Today` / `Yesterday` / `Monday` / `14 March 2025`.
 *
 * Relative labels only within the last week, where they are genuinely easier to read than a
 * date. An archive is usually old, so most separators are the full date — which is the right
 * default for something being checked against a memory.
 *
 * The language defaults to English so that `chat.test.ts`, which asserts the English labels,
 * needs no knowledge of the setting; the reader passes the live one.
 */
export function daySeparatorLabel(
  ts: number,
  now: number = Date.now(),
  language: Language = "en",
): string {
  if (sameDay(ts, now)) return RELATIVE[language].today;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(ts, yesterday.getTime())) return RELATIVE[language].yesterday;

  const date = new Date(ts);
  // Calendar days, not elapsed milliseconds: 23:00 yesterday and 08:00 today are nine hours
  // apart and two different days, and a threshold in milliseconds gets that backwards near
  // any boundary.
  const ageDays = calendarDaysBetween(ts, now);
  if (ageDays >= 0 && ageDays < 7) return DAY_NAMES[language][date.getDay()]!;

  // Built by hand rather than through `toLocaleDateString`: Hermes ships without full ICU, so
  // a `he` locale there silently falls back to English and the separator would be the one
  // place in the app that stayed in the wrong language.
  return `${date.getDate()} ${FULL_MONTHS[language][date.getMonth()]} ${date.getFullYear()}`;
}

/** `20:14`. The archive's timestamps are wall-clock, so this is deliberately not localized away. */
export function messageTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
