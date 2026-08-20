import { describe, expect, it } from "vitest";
import { parseExport } from "./parse.js";
import { normalizeInvisibles } from "./text.js";
import { mergeBatches } from "../merge.js";
import {
  ANDROID_EN_24H,
  BARE_MEDIA_ANDROID,
  CAPTIONED_ANDROID,
  CAPTIONED_ANDROID_NO_MEDIA,
  CAPTIONED_IOS,
  EMOJI_AND_ZWNJ,
  FAMILY_EMOJI,
  PERSIAN_ZWNJ,
  SYSTEM_EVENTS,
  SYSTEM_VERB_LOOKALIKES,
} from "./fixtures.js";

/**
 * Regressions for three defects that the original fixture set could not have caught, because
 * the fixtures were written from the same assumptions as the parser: every one of them put a
 * media caption on its own timestamped line, used no ordinary message containing a system
 * verb, and contained no ZWJ sequence.
 */

describe("captioned media", () => {
  it("keeps the attachment and treats the continuation line as the caption", () => {
    const [photo] = parseExport(CAPTIONED_ANDROID).messages;

    expect(photo?.kind).toBe("attachment");
    expect(photo?.attachment?.filename).toBe("IMG-20240315-WA0001.jpg");
    expect(photo?.body).toBe("That's the campsite");
    expect(photo?.sender).toBe("Dana");
  });

  it("does the same for the iOS marker shape", () => {
    const [photo] = parseExport(CAPTIONED_IOS).messages;

    expect(photo?.kind).toBe("attachment");
    expect(photo?.attachment?.filename).toBe(
      "00000042-PHOTO-2024-03-15-09-07-02.jpg",
    );
    expect(photo?.body).toBe("That's the campsite");
  });

  it("does not swallow the message that follows the caption", () => {
    const result = parseExport(CAPTIONED_ANDROID);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]?.body).toBe("Looks good");
  });

  // NOTE: built on CAPTIONED_ANDROID_NO_MEDIA, whose shape is an assumption rather than an
  // observation — see the fixture's comment. This proves the code handles that shape, not
  // that WhatsApp produces it.
  it("merges a captioned photo with the same photo from a without-media export", () => {
    const withMedia = parseExport(CAPTIONED_ANDROID).messages;
    const withoutMedia = parseExport(CAPTIONED_ANDROID_NO_MEDIA).messages;

    const merged = mergeBatches([
      { sourceId: "mine", messages: withMedia },
      { sourceId: "theirs", messages: withoutMedia },
    ]);

    // The whole point: one photo, not two.
    expect(merged).toHaveLength(2);
    const [photo] = merged;
    expect(photo?.kind).toBe("attachment");
    expect(photo?.attachment?.filename).toBe("IMG-20240315-WA0001.jpg");
    expect(photo?.sourceIds).toEqual(["mine", "theirs"]);
  });
});

describe("system-verb lookalikes", () => {
  it("keeps the sender on ordinary messages containing system verbs", () => {
    const result = parseExport(SYSTEM_VERB_LOOKALIKES);

    expect(result.messages).toHaveLength(6);
    for (const message of result.messages) {
      expect(message.kind, message.body).toBe("text");
      expect(message.sender, message.body).not.toBeNull();
    }
    expect(result.messages[0]?.body).toBe("I left my keys at home");
    expect(result.messages[0]?.sender).toBe("Dana");
    expect(result.participants).toEqual(["Dana", "Ravid"]);
  });

  it("still recognises genuine system events", () => {
    const result = parseExport(SYSTEM_EVENTS);

    expect(result.messages).toHaveLength(4);
    for (const message of result.messages) {
      expect(message.kind, message.body).toBe("system");
      expect(message.sender, message.body).toBeNull();
    }
    // The one system event that contains a colon, which is the case worth guarding.
    expect(result.messages[3]?.body).toBe("You changed the group name to: Camping 2024");
    expect(result.participants).toEqual([]);
  });
});

describe("normalization preserves content-bearing invisibles", () => {
  it("leaves ZWJ emoji sequences intact", () => {
    expect(normalizeInvisibles(FAMILY_EMOJI)).toBe(FAMILY_EMOJI);
    expect([...normalizeInvisibles(FAMILY_EMOJI)]).toHaveLength(7);
  });

  it("leaves Persian ZWNJ intact", () => {
    expect(normalizeInvisibles(PERSIAN_ZWNJ)).toBe(PERSIAN_ZWNJ);
  });

  it("preserves them through a full parse", () => {
    const result = parseExport(EMOJI_AND_ZWNJ);
    expect(result.messages[0]?.body).toBe(`${FAMILY_EMOJI} all packed`);
    expect(result.messages[1]?.body).toBe(PERSIAN_ZWNJ);
  });
});

/**
 * The check the plan called for: every non-empty line of the source is accounted for, and the
 * parsed messages re-serialize back to the original text. This is the test that does not share
 * assumptions with the parser — it compares against the raw file rather than against an
 * expectation someone typed out.
 */
describe("round-trip", () => {
  const reserialize = (source: string): string =>
    parseExport(source)
      .messages.map((m) => {
        const marker =
          m.kind === "attachment"
            ? `${m.attachment?.filename ?? ""} (file attached)`
            : m.kind === "omitted-media"
              ? "<Media omitted>"
              : null;

        const prefix = m.sender === null ? "" : `${m.sender}: `;
        const parts = [marker, m.body].filter((p) => p !== null && p !== "");
        const [date, time] = m.wallClock.split("T");
        const [year, month, day] = (date ?? "").split("-");
        const hhmm = (time ?? "").slice(0, 5);

        return `${day}/${month}/${year}, ${hhmm} - ${prefix}${parts.join("\n")}`;
      })
      .join("\n");

  it("reproduces an Android export line for line", () => {
    expect(reserialize(ANDROID_EN_24H)).toBe(ANDROID_EN_24H);
  });

  it("reproduces a captioned export, caption placement included", () => {
    expect(reserialize(CAPTIONED_ANDROID)).toBe(CAPTIONED_ANDROID);
  });

  it("accounts for every line of the source", () => {
    const sources = [
      ANDROID_EN_24H,
      CAPTIONED_ANDROID,
      CAPTIONED_ANDROID_NO_MEDIA,
      BARE_MEDIA_ANDROID,
      SYSTEM_VERB_LOOKALIKES,
      SYSTEM_EVENTS,
    ];

    for (const source of sources) {
      const result = parseExport(source);

      const parsedLines = result.messages.reduce((total, m) => {
        // A media message occupies its marker line plus however many caption lines follow;
        // an uncaptioned one has an empty body and occupies exactly the marker line.
        const markerLines =
          m.kind === "attachment" || m.kind === "omitted-media" ? 1 : 0;
        const bodyLines = m.body === "" ? 0 : m.body.split("\n").length;
        return total + markerLines + bodyLines;
      }, 0);

      expect(parsedLines + result.issues.length, source).toBe(source.split("\n").length);
    }
  });
});
