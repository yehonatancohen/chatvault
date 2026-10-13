import { describe, expect, it } from "vitest";
import { computeMessageId } from "../identity.js";
import { mergeBatches } from "../merge.js";
import { parseExport } from "./parse.js";

/**
 * The shapes a public corpus of real exports — 474 files, twenty app languages, both platforms
 * — showed the parser getting wrong. Every fixture here is hand-written (root CLAUDE.md,
 * invariant 6): the *structure* is copied from the real files, the names and words are not.
 *
 * What the corpus established, and these tests hold:
 *
 * 1. **WhatsApp marks its own text with a direction mark** — LRM in a left-to-right app
 *    language, RLM in Hebrew and Arabic. iOS puts one before the `[` of every media line and
 *    one before the marker; so a media line is recognisable in a language we have no words for.
 * 2. **iOS writes markers in the app's language**: `image absente`, `Bild weggelassen`,
 *    `لم يتم إدراج الصورة`. (An English-language iPhone in a Hebrew chat writes English ones,
 *    which is what the first real pair this project saw happened to be.)
 * 3. **Filenames have spaces** — every iOS document, every Android contact card.
 * 4. **The header is locale-shaped far beyond day/month order**: other digits, dots in the
 *    time, the time first, another calendar.
 */

const LRM = String.fromCharCode(0x200e);
const RLM = String.fromCharCode(0x200f);
const NBSP = String.fromCharCode(0xa0);
const ARABIC_COMMA = String.fromCharCode(0x060c);

const kinds = (raw: string): string[] => parseExport(raw).messages.map((m) => m.kind);

/** One chat, exported with and without media: the merged archive must be one copy of it. */
function expectOneArchive(withMedia: string, withoutMedia: string, count: number): void {
  const a = parseExport(withMedia);
  const b = parseExport(withoutMedia);
  expect(a.issues).toEqual([]);
  expect(b.issues).toEqual([]);
  expect(a.messages).toHaveLength(count);
  expect(b.messages).toHaveLength(count);
  const merged = mergeBatches([
    { sourceId: "with", messages: a.messages },
    { sourceId: "without", messages: b.messages },
  ]);
  expect(merged).toHaveLength(count);
  expect(merged.filter((m) => m.sourceIds.length === 1)).toEqual([]);
}

describe("iOS media lines, by where the marks stand", () => {
  const french = (media: boolean): string =>
    [
      `[14/03/2025 20:10:00] Maya: ${LRM}Les messages et les appels sont chiffrés de bout en bout.`,
      `[14/03/2025 20:10:30] Maya: bonjour`,
      `${LRM}[14/03/2025 20:11:02] Maya: ${LRM}${media ? "<pièce jointe : 00000003-PHOTO-2025-03-14-20-11-02.jpg>" : "image absente"}`,
      `${LRM}[14/03/2025 20:12:00] Tom: regarde ça ${LRM}${media ? "<pièce jointe : 00000004-VIDEO-2025-03-14-20-12-00.mp4>" : "vidéo absente"}`,
      `${LRM}[14/03/2025 20:13:00] Tom: Devis final.pdf • ${LRM}2 pages ${LRM}${media ? "<pièce jointe : 00000005-Devis final.pdf>" : "document manquant"}`,
      `${LRM}[14/03/2025 20:13:40] Maya: ${LRM}${media ? "<pièce jointe : 00000006-Maya Cohen.vcf>" : "Fiche contact manquante"}`,
      `[14/03/2025 20:14:00] Maya: ${LRM}Vous avez supprimé ce message.`,
    ].join("\n");

  it("reads an app language it has no table for", () => {
    expect(kinds(french(false))).toEqual([
      "text", "text", "omitted-media", "omitted-media", "omitted-media", "omitted-media", "deleted",
    ]);
    expect(kinds(french(true))).toEqual([
      "text", "text", "attachment", "attachment", "attachment", "attachment", "deleted",
    ]);
  });

  it("keeps a filename with spaces whole, and the caption beside it", () => {
    const messages = parseExport(french(true)).messages;
    expect(messages[4]?.attachment?.filename).toBe("00000005-Devis final.pdf");
    expect(messages[4]?.body).toBe("Devis final.pdf • 2 pages");
    expect(messages[5]?.attachment?.filename).toBe("00000006-Maya Cohen.vcf");
    expect(messages[3]?.body).toBe("regarde ça");
  });

  it("merges the with-media and without-media exports into one archive", () => {
    expectOneArchive(french(true), french(false), 7);
  });

  it("does the same in a right-to-left app language, where the mark is an RLM", () => {
    const hebrew = (media: boolean): string =>
      [
        `[14.3.2025, 20:10:30] נועה: בוקר טוב`,
        `${RLM}[14.3.2025, 20:11:02] נועה: ${RLM}${media ? "<מצורף: 00000003-PHOTO-2025-03-14-20-11-02.jpg>" : "התמונה הושמטה"}`,
        `${RLM}[14.3.2025, 20:12:00] אורי: תראי מה מצאתי ${RLM}${media ? "<מצורף: 00000004-PHOTO-2025-03-14-20-12-00.jpg>" : "התמונה הושמטה"}`,
        `${RLM}[14.3.2025, 20:13:00] אורי: סיכום פגישה.docx ${RLM}${media ? "<מצורף: 00000005-סיכום פגישה.docx>" : "המסמך הושמט"}`,
        `[14.3.2025, 20:14:00] נועה: ${RLM}מחקת הודעה זו.`,
      ].join("\n");
    expect(kinds(hebrew(false))).toEqual(["text", "omitted-media", "omitted-media", "omitted-media", "deleted"]);
    expect(parseExport(hebrew(true)).messages[3]?.attachment?.filename).toBe("00000005-סיכום פגישה.docx");
    expectOneArchive(hebrew(true), hebrew(false), 5);
  });

  it("finds the marker at the end of a caption that runs over several lines", () => {
    const raw = [
      `${LRM}[14/03/2025, 20:12:00] Tom: first line of the caption`,
      `second line ${LRM}<attached: 00000004-PHOTO-2025-03-14-20-12-00.jpg>`,
      `[14/03/2025, 20:13:00] Maya: nice`,
    ].join("\n");
    const [photo] = parseExport(raw).messages;
    expect(photo?.kind).toBe("attachment");
    expect(photo?.body).toBe("first line of the caption\nsecond line");
  });

  it("does not take a notice, a location or an edit for media, even on a marked line", () => {
    const raw = [
      `${LRM}[14/03/2025, 20:10:00] Maya: ${LRM}Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.`,
      `[14/03/2025, 20:11:00] Maya: ${LRM}Location: https://maps.google.com/?q=32.08,34.78`,
      `${LRM}[14/03/2025, 20:12:00] Maya: see you at nine ${LRM}<This message was edited>`,
    ].join("\n");
    expect(kinds(raw)).toEqual(["text", "text", "text"]);
    expect(parseExport(raw).messages[2]?.body).toBe("see you at nine <This message was edited>");
  });
});

describe("Android markers", () => {
  it("recognises the omitted placeholder in any app language", () => {
    const raw = [
      "15.03.24, 09:05 - Dana: <Média vynechány>",
      "15.03.24, 09:06 - Dana: <Без медиафайлов>",
      "15.03.24, 09:07 - Dana: <המדיה לא נכללה>",
      "15.03.24, 09:08 - Dana: <Media omitted>",
      "A caption, which Android puts on the next line",
    ].join("\n");
    expect(kinds(raw)).toEqual(["omitted-media", "omitted-media", "omitted-media", "omitted-media"]);
    expect(parseExport(raw).messages[3]?.body).toBe("A caption, which Android puts on the next line");
  });

  it("leaves markup someone typed alone", () => {
    const raw = [
      "15/03/2024, 09:05 - Dana: <div>",
      '15/03/2024, 09:06 - Dana: <a href="x">',
      "15/03/2024, 09:07 - Dana: <3",
    ].join("\n");
    expect(kinds(raw)).toEqual(["text", "text", "text"]);
  });

  it("takes the whole line as the filename — contact cards and documents have spaces", () => {
    const raw = [
      "15/03/2024, 09:05 - Dana: Ravid Levi.vcf (file attached)",
      "15/03/2024, 09:06 - Dana: Budget (final) 2.pdf (file attached)",
      `15.03.24, 09:07 - Dana: ${LRM}Ravid Levi.vcf (soubor byl přiložen)`,
      "15.03.24, 09:08 - Dana: Ravid Levi.vcf (קובץ מצורף)",
    ].join("\n");
    expect(parseExport(raw).messages.map((m) => m.attachment?.filename)).toEqual([
      "Ravid Levi.vcf",
      "Budget (final) 2.pdf",
      "Ravid Levi.vcf",
      "Ravid Levi.vcf",
    ]);
  });

  it("does not read a sentence that ends in brackets as an attachment", () => {
    const raw = [
      "15/03/2024, 09:05 - Dana: see report.pdf (the new one)",
      "15/03/2024, 09:06 - Dana: console.log(ok)",
      // Even behind a direction mark, which a right-to-left phone may put on any body.
      `15/03/2024, 09:07 - דנה: ${RLM}ראית את doc.pdf (הישן)`,
      "15/03/2024, 09:08 - Dana: <!DOCTYPE html>",
    ].join("\n");
    const messages = parseExport(raw).messages;
    expect(messages.map((m) => m.kind)).toEqual(["text", "text", "text", "text"]);
    expect(messages[2]?.body).toBe("ראית את doc.pdf (הישן)");
    // Read as an attachment, the bracketed words were dropped from the archive.
    expect(messages[0]?.body).toBe("see report.pdf (the new one)");
  });
});

describe("deleted messages", () => {
  it("knows the tombstone with the full stop iOS adds", () => {
    const raw = [
      `[14/03/2025, 20:14:00] Maya: ${LRM}You deleted this message.`,
      `[14/03/2025, 20:15:00] Tom: ${LRM}This message was deleted.`,
    ].join("\n");
    expect(kinds(raw)).toEqual(["deleted", "deleted"]);
  });
});

describe("header dialects", () => {
  const one = (raw: string) => {
    const result = parseExport(raw);
    expect(result.issues).toEqual([]);
    return result;
  };

  it("Arabic: its own digits, its own comma, RLMs between the fields", () => {
    const date = `١٨${RLM}/٣${RLM}/٢٠٢٢${ARABIC_COMMA} ٢:٥٦:٠٠${NBSP}م`;
    const result = one(`[${date}] Maya: hello\n${RLM}[${date}] Maya: ${RLM}لم يتم إدراج الصورة`);
    expect(result.messages.map((m) => m.wallClock)).toEqual(["2022-03-18T14:56:00", "2022-03-18T14:56:00"]);
    expect(result.messages[1]?.kind).toBe("omitted-media");
    // Only the header is converted — a body keeps the digits it was typed in.
    expect(one(`[${date}] Maya: ٣ دقائق`).messages[0]?.body).toBe("٣ دقائق");
  });

  it("Indonesian: dots in the time and no comma", () => {
    expect(one("[18/03/22 14.56.01] Maya: halo").messages[0]?.wallClock).toBe("2022-03-18T14:56:01");
  });

  it("Vietnamese: the time before the date", () => {
    expect(one("[14:56:01, 18/3/22] Maya: xin chào").messages[0]?.wallClock).toBe("2022-03-18T14:56:01");
  });

  it("a phone on the Buddhist or the Japanese calendar", () => {
    expect(one("[18/3/2565 BE, 14:56:01] Maya: hi").messages[0]?.wallClock).toBe("2022-03-18T14:56:01");
    expect(one("[18/3/R4, 14:56:01] Maya: hi").messages[0]?.wallClock).toBe("2022-03-18T14:56:01");
  });

  it("a 12-hour clock in Hebrew, and a spelled-out part of the day", () => {
    expect(one("15.3.2024, 9:05 אחה״צ - דנה: היי").messages[0]?.wallClock).toBe("2024-03-15T21:05:00");
    expect(one("15/03/2024, 9:15 in the morning - Dana: hi").messages[0]?.wallClock).toBe("2024-03-15T09:15:00");
    expect(one("15/03/2024, 11:30 at night - Dana: hi").messages[0]?.wallClock).toBe("2024-03-15T23:30:00");
  });

  it("keeps messages pasted from WhatsApp Web inside the message they were pasted into", () => {
    const raw = [
      "[15/03/2024, 09:05:10] Dana: look what he wrote:",
      "[9:01 AM, 3/15/2024] Ravid: I am not coming",
      "[9:02 AM, 3/15/2024] Ravid: sorry",
      "[15/03/2024, 09:06:00] Ravid: :(",
    ].join("\n");
    const result = parseExport(raw);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.body.split("\n")).toHaveLength(3);
    expect(result.participants).toEqual(["Dana", "Ravid"]);
  });
});

describe("what one minute can hold", () => {
  const raw = [
    "15/03/2024, 09:05 - Dana: first",
    "15/03/2024, 09:05 - Ravid: ok",
    "15/03/2024, 09:05 - Dana: second",
    "15/03/2024, 09:05 - Ravid: ok",
    "15/03/2024, 09:05 - Dana: third",
  ].join("\n");

  it("keeps the same words said twice as two messages", () => {
    const messages = parseExport(raw).messages;
    expect(new Set(messages.map((m) => m.id)).size).toBe(5);
    // The first keeps the id it always had, so an archive made before this is not disturbed.
    expect(messages[1]?.id).toBe(
      computeMessageId({ wallClock: "2024-03-15T09:05:00", sender: "Ravid", body: "ok", kind: "text" }),
    );
  });

  it("stays idempotent: the same export twice is still one copy", () => {
    const once = parseExport(raw).messages;
    const merged = mergeBatches([
      { sourceId: "a", messages: once },
      { sourceId: "b", messages: parseExport(raw).messages },
    ]);
    expect(merged).toHaveLength(5);
  });

  it("comes out of a merge in the order it was written, though Android prints no seconds", () => {
    const merged = mergeBatches([{ sourceId: "a", messages: parseExport(raw).messages }]);
    expect(merged.map((m) => m.body)).toEqual(["first", "ok", "second", "ok", "third"]);
  });
});

describe("participants", () => {
  it("does not count the name an iOS group's notices are filed under", () => {
    const raw = [
      `[14/03/2025, 20:10:00] Hiking Club: ${LRM}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`,
      `[14/03/2025, 20:10:00] ${LRM}Maya created group "Hiking Club"`,
      `[14/03/2025, 20:11:00] Maya: who is in?`,
      `[14/03/2025, 20:12:00] Tom: me`,
    ].join("\n");
    expect(parseExport(raw).participants).toEqual(["Maya", "Tom"]);
  });

  it("still counts the other person in a 1:1 chat, whose name the notice also carries", () => {
    const raw = [
      `[14/03/2025, 20:10:00] Maya: ${LRM}Messages and calls are end-to-end encrypted.`,
      `[14/03/2025, 20:11:00] Maya: hi`,
    ].join("\n");
    expect(parseExport(raw).participants).toEqual(["Maya"]);
  });
});
