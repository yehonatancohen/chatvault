import { describe, expect, it } from "vitest";
import { parseExport } from "./parser/parse.js";
import { describeMessage, formatText, mediaTypeOf } from "./present.js";

const LRM = String.fromCharCode(0x200e);

/** Parse one export line (plus any continuation lines) and describe the message it makes. */
const view = (...lines: string[]) => {
  const message = parseExport(lines.join("\n")).messages[0];
  if (!message) throw new Error("fixture did not parse");
  return describeMessage(message);
};

describe("describeMessage", () => {
  it("leaves ordinary text as it is", () => {
    expect(view("15/03/2024, 09:05 - Dana: see you at 9")).toEqual({
      type: "text",
      text: "see you at 9",
      edited: false,
    });
  });

  it("takes the edit marker off the text and reports it", () => {
    expect(view("15/03/2024, 09:05 - Dana: see you at 10 <This message was edited>")).toEqual({
      type: "text",
      text: "see you at 10",
      edited: true,
    });
    expect(view("15.3.2024, 9:05 - דנה: נתראה בעשר <ההודעה נערכה>")).toMatchObject({
      text: "נתראה בעשר",
      edited: true,
    });
  });

  it("shows WhatsApp's own notices as notices, though the export files them under a name", () => {
    expect(
      view(`[14/03/2025, 20:10:00] Maya: ${LRM}Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.`),
    ).toMatchObject({ type: "notice" });
    expect(view(`[14/03/2025, 20:10:00] Maya: ${LRM}Your security code with Maya changed. Tap to learn more.`)).toMatchObject({ type: "notice" });
    expect(view("14.3.2025, 20:10 - נועה: ההודעות והשיחות מוצפנות מקצה לקצה. רק אנשים בצ'אט הזה יכולים לקרוא אותן.")).toMatchObject({ type: "notice" });
    expect(view("15/03/2024, 09:00 - Dana created group \"Camping\"")).toMatchObject({ type: "notice" });
  });

  it("does not take something a person said about encryption for a notice", () => {
    expect(view("15/03/2024, 09:05 - Dana: I turned on disappearing messages")).toMatchObject({ type: "text" });
  });

  it("reads a location in any app language", () => {
    for (const word of ["Location", "location", "Localisation", "מיקום", "Standort"]) {
      expect(view(`15/03/2024, 09:05 - Dana: ${word}: https://maps.google.com/?q=32.0853,-34.7818`)).toEqual({
        type: "location",
        live: false,
        url: "https://maps.google.com/?q=32.0853,-34.7818",
        latitude: 32.0853,
        longitude: -34.7818,
        edited: false,
      });
    }
    expect(view("15/03/2024, 09:05 - Dana: live location shared")).toMatchObject({ type: "location", live: true });
    expect(
      view("15/03/2024, 09:05 - Dana: Old Port", "Tel Aviv", "https://foursquare.com/v/4e89af95e5fa82ad4c0aa03b"),
    ).toMatchObject({ type: "location", label: "Old Port, Tel Aviv" });
    // A link to a map inside a sentence is a sentence.
    expect(view("15/03/2024, 09:05 - Dana: meet here https://maps.google.com/?q=32.0,34.7 ok?")).toMatchObject({ type: "text" });
  });

  it("reads a poll", () => {
    expect(
      view("15/03/2024, 09:05 - Dana: POLL:", "Where do we eat?", "OPTION: Pizza (2 votes)", "OPTION: Sushi (0 votes)", ""),
    ).toEqual({
      type: "poll",
      question: "Where do we eat?",
      options: [
        { text: "Pizza", votes: 2 },
        { text: "Sushi", votes: 0 },
      ],
      edited: false,
    });
  });

  it("reads calls", () => {
    expect(view("15/03/2024, 09:05 - Dana: Missed voice call")).toMatchObject({ type: "call", missed: true, video: false, group: false });
    expect(view("15/03/2024, 09:05 - Dana: Missed group video call")).toMatchObject({ type: "call", missed: true, video: true, group: true });
    expect(view(`[14/03/2025, 20:10:00] Maya: ${LRM}Video call. 12 min`)).toMatchObject({ type: "call", missed: false, video: true });
    expect(view("15/03/2024, 09:05 - Dana: Video call karu?")).toMatchObject({ type: "text" });
  });

  it("says so where WhatsApp exported nothing at all", () => {
    expect(view("15/03/2024, 09:05 - Dana: null")).toMatchObject({ type: "unavailable" });
    expect(view("15/03/2024, 09:05 - Dana: Waiting for this message")).toMatchObject({ type: "unavailable" });
  });

  it("names a document, and keeps a caption apart from it", () => {
    expect(
      view(`${LRM}[14/03/2025, 20:13:00] Tom: Quote final.pdf • ${LRM}2 pages ${LRM}<attached: 00000005-Quote final.pdf>`),
    ).toEqual({
      type: "media",
      media: "document",
      filename: "00000005-Quote final.pdf",
      title: "Quote final.pdf",
      detail: "2 pages",
      caption: "",
      edited: false,
    });
    expect(view(`${LRM}[14/03/2025, 20:13:00] Tom: Quote final.pdf ${LRM}document omitted`)).toMatchObject({
      media: "document",
      title: "Quote final.pdf",
      caption: "",
    });
    expect(view(`${LRM}[14/03/2025, 20:13:00] Tom: look at this ${LRM}<attached: 00000005-PHOTO-2025-03-14-20-13-00.jpg>`)).toMatchObject({
      media: "image",
      caption: "look at this",
    });
    expect(view("15/03/2024, 09:05 - Dana: Ravid Levi.vcf (file attached)")).toMatchObject({ media: "contact", title: "Ravid Levi" });
  });

  it("describes a tombstone an older archive stored as text", () => {
    expect(describeMessage({ kind: "text", body: "You deleted this message." })).toEqual({ type: "deleted", edited: false });
  });
});

describe("mediaTypeOf", () => {
  it("tells a sticker from a photo and a GIF from a video by WhatsApp's own name for it", () => {
    expect(mediaTypeOf("00000049-STICKER-2025-03-15-15-48-45.webp")).toBe("sticker");
    expect(mediaTypeOf("STK-20220323-WA0003.webp")).toBe("sticker");
    expect(mediaTypeOf("00000051-GIF-2022-03-27-21-51-57.mp4")).toBe("gif");
    expect(mediaTypeOf("VID-20220327-WA0001.mp4")).toBe("video");
    expect(mediaTypeOf("PTT-20220323-WA0000.opus")).toBe("audio");
    expect(mediaTypeOf("00000043-PHOTO-2025-03-14-20-10-34.jpg")).toBe("image");
    expect(mediaTypeOf("Quote final.pdf")).toBe("document");
    expect(mediaTypeOf("Ravid Levi.vcf")).toBe("contact");
  });
});

describe("formatText", () => {
  const plain = (text: string): string => formatText(text).map((s) => s.text).join("");

  it("sets WhatsApp's emphasis marks", () => {
    expect(formatText("this is *bold*, _slanted_ and ~gone~")).toEqual([
      { text: "this is " },
      { text: "bold", bold: true },
      { text: ", " },
      { text: "slanted", italic: true },
      { text: " and " },
      { text: "gone", strike: true },
    ]);
    expect(formatText("*_both_*")).toEqual([{ text: "both", bold: true, italic: true }]);
    expect(formatText("run `npm test` now")).toEqual([{ text: "run " }, { text: "npm test", code: true }, { text: " now" }]);
    expect(formatText("*שלום* עולם")).toEqual([{ text: "שלום", bold: true }, { text: " עולם" }]);
  });

  it("leaves arithmetic, identifiers and lone marks exactly as typed", () => {
    for (const text of ["2*3*4", "snake_case_name", "a * b * c", "~", "5 * 5", "* not bold *", "line one*\n*line two"]) {
      expect(formatText(text)).toEqual([{ text }]);
    }
  });

  it("makes links followable and nothing else", () => {
    expect(formatText("see https://example.com/a?b=1, ok")).toEqual([
      { text: "see " },
      { text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { text: ", ok" },
    ]);
    expect(formatText("www.example.com")).toEqual([{ text: "www.example.com", href: "https://www.example.com" }]);
    expect(formatText("javascript:alert(1) file:///etc")).toEqual([{ text: "javascript:alert(1) file:///etc" }]);
  });

  it("never loses a character other than the marks", () => {
    expect(plain("a_b https://x.io/snake_case_path *b* 1*2*3")).toBe("a_b https://x.io/snake_case_path b 1*2*3");
  });
});
