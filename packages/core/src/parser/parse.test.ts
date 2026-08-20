import { describe, expect, it } from "vitest";
import { parseExport } from "./parse.js";
import {
  AMBIGUOUS_DATES,
  ANDROID_EN_24H,
  ANDROID_HE,
  IOS_EN_24H,
  IOS_US_12H,
  MULTILINE,
} from "./fixtures.js";

describe("parseExport — dialects", () => {
  it("parses Android 24h English", () => {
    const result = parseExport(ANDROID_EN_24H);

    expect(result.issues).toEqual([]);
    expect(result.messages).toHaveLength(6);
    expect(result.dialect).toMatchObject({
      platform: "android",
      dateOrder: "DMY",
      clock: "24h",
      hasSeconds: false,
    });
    expect(result.participants).toEqual(["Dana", "Ravid"]);
  });

  it("parses iOS bracketed headers and strips the LRM marks", () => {
    const result = parseExport(IOS_EN_24H);

    expect(result.issues).toEqual([]);
    expect(result.messages).toHaveLength(4);
    expect(result.dialect).toMatchObject({ platform: "ios", hasSeconds: true });
    // The LRM before the sender must not survive into the participant name.
    expect(result.participants).toEqual(["Dana", "Ravid"]);
    expect(result.messages[0]?.sender).toBe("Dana");
  });

  it("parses US month-first dates and the narrow no-break space before AM/PM", () => {
    const result = parseExport(IOS_US_12H);

    expect(result.dialect).toMatchObject({ dateOrder: "MDY", clock: "12h" });
    expect(result.messages[0]?.wallClock).toBe("2024-03-15T09:05:12");
    // 2:06:33 PM must become 14:06:33, not stay at 02.
    expect(result.messages[1]?.wallClock).toBe("2024-03-15T14:06:33");
    // 11:59 PM is the classic 12-hour rollover bug.
    expect(result.messages[2]?.wallClock).toBe("2024-12-25T23:59:00");
  });

  it("parses Hebrew RTL exports with dot-separated dates", () => {
    const result = parseExport(ANDROID_HE);

    expect(result.issues).toEqual([]);
    expect(result.messages).toHaveLength(5);
    expect(result.participants).toEqual(["דנה", "רביד"]);
    expect(result.messages[0]?.sender).toBeNull(); // encryption notice
    expect(result.messages[0]?.kind).toBe("system");
    // RTL marks stripped from the body, text otherwise intact.
    expect(result.messages[1]?.body).toBe("בוקר טוב! אנחנו עדיין בעניין של שבת?");
  });
});

describe("parseExport — message shapes", () => {
  it("folds continuation lines, including blank ones and ones starting with digits", () => {
    const result = parseExport(MULTILINE);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.body).toBe(
      "Here's the packing list:\n1. Tent\n2. Stove\n\n3. Coffee — non-negotiable",
    );
    expect(result.messages[1]?.body).toBe("Noted");
  });

  it("classifies attachments in both Android and iOS phrasings", () => {
    const android = parseExport(ANDROID_EN_24H).messages.find(
      (m) => m.kind === "attachment",
    );
    expect(android?.attachment?.filename).toBe("IMG-20240315-WA0001.jpg");

    const ios = parseExport(IOS_EN_24H).messages.find((m) => m.kind === "attachment");
    expect(ios?.attachment?.filename).toBe("00000042-PHOTO-2024-03-15-09-07-02.jpg");
  });

  it("classifies localized attachment and deletion markers", () => {
    const result = parseExport(ANDROID_HE);

    expect(result.messages.find((m) => m.kind === "attachment")?.attachment?.filename).toBe(
      "IMG-20240315-WA0001.jpg",
    );
    expect(result.messages.some((m) => m.kind === "deleted")).toBe(true);
  });

  it("treats the encryption notice as a system message with no sender", () => {
    const [first] = parseExport(ANDROID_EN_24H).messages;
    expect(first?.sender).toBeNull();
    expect(first?.kind).toBe("system");
  });

  it("does not mistake a colon in a system event for a sender name", () => {
    const result = parseExport("15/03/2024, 09:05 - You changed the group name to: Trip");
    expect(result.messages[0]?.sender).toBeNull();
    expect(result.messages[0]?.kind).toBe("system");
  });
});

describe("parseExport — dates", () => {
  it("infers day-first when a day above 12 appears anywhere in the file", () => {
    expect(parseExport(ANDROID_EN_24H).dialect.dateOrder).toBe("DMY");
    expect(parseExport(ANDROID_EN_24H).messages[5]?.wallClock).toBe("2024-03-20T22:41:00");
  });

  it("falls back rather than guessing when the file is genuinely ambiguous", () => {
    expect(parseExport(AMBIGUOUS_DATES).dialect.dateOrder).toBe("DMY");
    expect(parseExport(AMBIGUOUS_DATES, { dateOrderFallback: "MDY" }).dialect.dateOrder).toBe(
      "MDY",
    );
  });

  it("resolves epoch time independently of the machine's own timezone", () => {
    const [first] = parseExport(ANDROID_EN_24H, { tzOffsetMinutes: 0 }).messages;
    expect(first?.ts).toBe(Date.UTC(2024, 2, 15, 9, 4, 0));

    // Same wall-clock, declared as UTC+3, is three hours earlier in absolute terms.
    const [shifted] = parseExport(ANDROID_EN_24H, { tzOffsetMinutes: 180 }).messages;
    expect(shifted?.ts).toBe(Date.UTC(2024, 2, 15, 6, 4, 0));
  });

  it("records an issue instead of rolling over an impossible date", () => {
    const result = parseExport("31/02/2024, 09:05 - Dana: nope");
    expect(result.messages).toHaveLength(0);
    expect(result.issues[0]?.reason).toBe("bad-datetime");
  });

  it("records leading junk as an issue rather than dropping it silently", () => {
    const result = parseExport("garbage header line\n15/03/2024, 09:05 - Dana: hi");
    expect(result.messages).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ reason: "unparsable-header", line: 1 });
  });
});
