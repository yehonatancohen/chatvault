/**
 * Turning a flat message list into the shape a chat is actually read in.
 *
 * A port of the app's `apps/mobile/lib/ui/chat.ts`, which is where the rules are documented and
 * where they are tested (`chat.test.ts`). Kept as a copy rather than moved into `core` on
 * purpose: `core` is the archive's brain — parser, identity, merge, format — and view-model
 * shaping is not part of it. The two copies must agree, so change them together; the grouping
 * rule in particular (same sender, same day, within five minutes) is what makes a run of
 * messages read as one turn in both clients.
 *
 * Hebrew only, because this site is (`app/layout.tsx` → `lang="he"`).
 */

import type { MergedMessage } from "@chatvault/core";

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
      /** Last of a run: the row that carries the tail. */
      readonly endsGroup: boolean;
    };

export function buildChatRows(messages: readonly MergedMessage[]): ChatRow[] {
  const rows: ChatRow[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]!;
    const previous = messages[i - 1];
    const next = messages[i + 1];

    if (previous === undefined || !sameDay(previous.ts, message.ts)) {
      rows.push({ kind: "day", key: `day-${message.ts}-${i}`, ts: message.ts });
    }

    rows.push({
      // The id alone is not safe as a key: identity is content-derived, so a person sending the
      // same word twice in one minute produces two messages with one id.
      kind: "message",
      key: `${message.id}-${i}`,
      message,
      startsGroup: !continues(previous, message),
      endsGroup: !continues(message, next),
    });
  }

  return rows;
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

export function sameDay(a: number, b: number): boolean {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

const DAY_NAMES = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"] as const;
const MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
] as const;

/**
 * `היום` / `אתמול` / `יום שני` / `14 במרץ 2025`.
 *
 * Relative labels only within the last week. A shared archive is usually old, so most separators
 * are the full date — the right default for something being read against a memory.
 */
export function daySeparatorLabel(ts: number, now: number = Date.now()): string {
  if (sameDay(ts, now)) return "היום";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(ts, yesterday.getTime())) return "אתמול";

  const date = new Date(ts);
  // Calendar days, not elapsed milliseconds: 23:00 yesterday and 08:00 today are nine hours
  // apart and two different days, and a threshold in milliseconds gets that backwards.
  const ageDays = calendarDaysBetween(ts, now);
  if (ageDays >= 0 && ageDays < 7) return DAY_NAMES[date.getDay()]!;
  return `${date.getDate()} ב${MONTHS[date.getMonth()]!} ${date.getFullYear()}`;
}

function calendarDaysBetween(earlier: number, later: number): number {
  const startOfDay = (ts: number): number => {
    const date = new Date(ts);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  return Math.round((startOfDay(later) - startOfDay(earlier)) / (24 * 60 * 60 * 1000));
}

/** `20:14`. The archive's timestamps are wall-clock, so this is deliberately not localized away. */
export function messageTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * A stable colour per participant, so a name keeps its colour down the whole conversation.
 * Hue only, from a hash of the name — no participant is louder than another. Matches the app.
 */
export function colorForParticipant(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 45%, 38%)`;
}

/**
 * `הודעה אחת` / `50 הודעות`. Hebrew names the single case rather than counting it, and
 * "1 הודעות" is the kind of seam that makes a screen look machine-made.
 */
export function countLabel(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count.toLocaleString("he-IL")} ${many}`;
}

/** Bytes, at a precision that never rounds a real file down to nothing. Matches the app. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** `14 במרץ 2025`. */
export function formatDate(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  const date = new Date(ts);
  return `${date.getDate()} ב${MONTHS[date.getMonth()]!} ${date.getFullYear()}`;
}

/** A date range as one phrase, collapsed when both ends fall on one day. */
export function formatRange(firstTs: number, lastTs: number): string {
  if (firstTs <= 0 || lastTs <= 0) return "-";
  const first = formatDate(firstTs);
  const last = formatDate(lastTs);
  return first === last ? first : `${first} — ${last}`;
}
