import { describe, expect, it } from "vitest";
import type { MergedMessage } from "@chatvault/core";
import {
  buildChatRows,
  daySeparatorLabel,
  forInvertedList,
  GROUP_GAP_MS,
  messageTime,
} from "./chat";

let counter = 0;
function message(overrides: Partial<MergedMessage> & { ts: number }): MergedMessage {
  counter += 1;
  return {
    id: `m${counter}`,
    wallClock: "2025-03-14T20:10:00",
    sender: "Dana",
    body: "hello",
    kind: "text",
    sourceIds: ["s1"],
    ...overrides,
  } as MergedMessage;
}

const day = (y: number, m: number, d: number, hh = 12, mm = 0): number =>
  new Date(y, m - 1, d, hh, mm).getTime();

describe("buildChatRows", () => {
  it("puts a day separator before the first message of each day", () => {
    const rows = buildChatRows([
      message({ ts: day(2025, 3, 14, 20, 10) }),
      message({ ts: day(2025, 3, 14, 20, 11) }),
      message({ ts: day(2025, 3, 15, 9, 0) }),
    ]);

    expect(rows.map((r) => r.kind)).toEqual(["day", "message", "message", "day", "message"]);
  });

  it("groups a run from one sender under a single name", () => {
    const rows = buildChatRows([
      message({ ts: day(2025, 3, 14, 20, 10), sender: "Dana" }),
      message({ ts: day(2025, 3, 14, 20, 11), sender: "Dana" }),
      message({ ts: day(2025, 3, 14, 20, 12), sender: "Yonatan" }),
    ]);

    const messages = rows.filter((r) => r.kind === "message");
    expect(messages.map((r) => (r.kind === "message" ? r.startsGroup : null))).toEqual([
      true,
      false,
      true,
    ]);
    expect(messages.map((r) => (r.kind === "message" ? r.endsGroup : null))).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("breaks a group when the same person speaks again much later", () => {
    // Stacking these under one name would imply the second followed the first immediately —
    // a small lie about when something was said, in a record someone is checking.
    const rows = buildChatRows([
      message({ ts: day(2025, 3, 14, 9, 0), sender: "Dana" }),
      message({ ts: day(2025, 3, 14, 9, 0) + GROUP_GAP_MS + 1000, sender: "Dana" }),
    ]);

    const messages = rows.filter((r) => r.kind === "message");
    expect(messages.every((r) => r.kind === "message" && r.startsGroup)).toBe(true);
  });

  it("never groups across a system notice", () => {
    const rows = buildChatRows([
      message({ ts: day(2025, 3, 14, 9, 0), sender: "Dana" }),
      message({ ts: day(2025, 3, 14, 9, 1), sender: null, kind: "system", body: "notice" }),
      message({ ts: day(2025, 3, 14, 9, 2), sender: "Dana" }),
    ]);

    const messages = rows.filter((r) => r.kind === "message");
    expect(messages.map((r) => (r.kind === "message" ? r.startsGroup : null))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("gives every row a key unique even when two messages share an id", () => {
    // Identity is content-derived: the same word twice in one minute is one id, two messages.
    const twice = message({ ts: day(2025, 3, 14, 9, 0) });
    const rows = buildChatRows([twice, twice]);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("handles an empty archive", () => {
    expect(buildChatRows([])).toEqual([]);
  });
});

describe("forInvertedList", () => {
  it("puts the newest row first, so an inverted list opens at the bottom", () => {
    const rows = buildChatRows([
      message({ ts: day(2025, 3, 14, 20, 10), body: "first" }),
      message({ ts: day(2025, 3, 14, 20, 11), body: "last" }),
    ]);

    const inverted = forInvertedList(rows);
    const newest = inverted[0];
    expect(newest?.kind).toBe("message");
    expect(newest?.kind === "message" ? newest.message.body : "").toBe("last");
    // The day separator, which came first, must end up last — it sits above the day it labels.
    expect(inverted[inverted.length - 1]?.kind).toBe("day");
  });

  it("does not mutate its input", () => {
    const rows = buildChatRows([message({ ts: day(2025, 3, 14) })]);
    const before = [...rows];
    forInvertedList(rows);
    expect(rows).toEqual(before);
  });
});

describe("daySeparatorLabel", () => {
  const now = day(2025, 3, 20, 15, 0);

  it("says Today and Yesterday", () => {
    expect(daySeparatorLabel(day(2025, 3, 20, 9, 0), now)).toBe("Today");
    expect(daySeparatorLabel(day(2025, 3, 19, 9, 0), now)).toBe("Yesterday");
  });

  it("names the weekday within the last week", () => {
    expect(daySeparatorLabel(day(2025, 3, 17, 9, 0), now)).toBe("Monday");
    expect(daySeparatorLabel(day(2025, 3, 14, 9, 0), now)).toBe("Friday");
  });

  it("falls back to a full date for anything older, which is most of an archive", () => {
    expect(daySeparatorLabel(day(2025, 3, 13, 9, 0), now)).toBe("13 March 2025");
    expect(daySeparatorLabel(day(2024, 12, 25, 9, 0), now)).toBe("25 December 2024");
  });

  it("counts by calendar day, not by elapsed hours", () => {
    // 23:00 yesterday is nine hours before 08:00 today and is still "Yesterday"; an
    // elapsed-milliseconds threshold calls it today.
    expect(daySeparatorLabel(day(2025, 3, 19, 23, 0), day(2025, 3, 20, 8, 0))).toBe("Yesterday");
  });
});

describe("messageTime", () => {
  it("is zero-padded 24-hour wall clock", () => {
    expect(messageTime(day(2025, 3, 14, 9, 5))).toBe("09:05");
    expect(messageTime(day(2025, 3, 14, 20, 14))).toBe("20:14");
  });
});
