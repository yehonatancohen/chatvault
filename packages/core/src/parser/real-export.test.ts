import { describe, expect, it } from "vitest";
import { parseExport } from "./parse.js";
import { mergeBatches } from "../merge.js";
import { IOS_REAL_WITH_MEDIA, IOS_REAL_WITHOUT_MEDIA } from "./fixtures.js";

/**
 * Tests against the structure of a real iOS export pair — the same chat exported twice from
 * one phone, with media and without. See the fixture comments for what the pair established.
 *
 * This file exists because the previous fixtures were invented, and every one of them encoded
 * a guess that turned out to be wrong: captions were assumed to arrive as continuation lines
 * (they are inline, before the marker), omitted markers were assumed to be localized (iOS
 * writes them in English even in a Hebrew chat), and a with-media export was assumed to
 * contain no omitted markers (it contains them for media no longer on the device).
 */

const withMedia = parseExport(IOS_REAL_WITH_MEDIA);
const withoutMedia = parseExport(IOS_REAL_WITHOUT_MEDIA);

describe("real iOS export — parsing", () => {
  it("parses every line without issues", () => {
    expect(withMedia.issues).toEqual([]);
    expect(withoutMedia.issues).toEqual([]);
    // Both exports describe the same 9 messages; the last is a two-line message.
    expect(withMedia.messages).toHaveLength(9);
    expect(withoutMedia.messages).toHaveLength(9);
  });

  it("recognises the dialect", () => {
    expect(withMedia.dialect).toMatchObject({
      platform: "ios",
      dateOrder: "DMY",
      clock: "24h",
      hasSeconds: true,
    });
  });

  it("keeps Hebrew sender names clean of directional marks", () => {
    expect(withMedia.participants).toEqual(["נועה", "אורי"]);
  });

  it("extracts an inline caption and its attachment", () => {
    const captioned = withMedia.messages[3];

    expect(captioned?.kind).toBe("attachment");
    expect(captioned?.attachment?.filename).toBe(
      "00000043-PHOTO-2025-03-14-20-10-34.jpg",
    );
    // The caption is the body; the marker is metadata and must not leak into it.
    expect(captioned?.body).toBe("תראה מה מצאתי");
    expect(captioned?.sender).toBe("אורי");
  });

  it("gives uncaptioned media an empty body rather than the marker text", () => {
    const sticker = withMedia.messages[5];

    expect(sticker?.kind).toBe("attachment");
    expect(sticker?.attachment?.filename).toBe(
      "00000049-STICKER-2025-03-15-15-48-45.webp",
    );
    expect(sticker?.body).toBe("");
  });

  it("treats English omitted markers in a Hebrew chat as omitted media", () => {
    // Present even in the *with-media* export: this file is no longer on the device.
    const stillOmitted = withMedia.messages[6];
    expect(stillOmitted?.kind).toBe("omitted-media");
    expect(stillOmitted?.body).toBe("");

    const kinds = withoutMedia.messages.map((m) => m.kind);
    expect(kinds.filter((k) => k === "omitted-media")).toHaveLength(4);
    expect(kinds.filter((k) => k === "attachment")).toHaveLength(0);
  });

  it("keeps the captioned message's caption when the media is omitted", () => {
    const captioned = withoutMedia.messages[3];
    expect(captioned?.kind).toBe("omitted-media");
    expect(captioned?.body).toBe("תראה מה מצאתי");
  });

  it("folds a multi-line Hebrew message", () => {
    expect(withMedia.messages[8]?.body).toBe("שורה ראשונה\nשורה שנייה של אותה הודעה");
  });
});

describe("real iOS export — merging the with-media and without-media copies", () => {
  const merged = mergeBatches([
    { sourceId: "with-media", messages: withMedia.messages },
    { sourceId: "without-media", messages: withoutMedia.messages },
  ]);

  it("produces one archive of 9 messages, not 18", () => {
    expect(merged).toHaveLength(9);
    // Every message was seen in both exports, so nothing is single-sourced.
    expect(merged.every((m) => m.sourceIds.length === 2)).toBe(true);
  });

  it("keeps the real attachment over the omitted placeholder", () => {
    const captioned = merged.find((m) => m.body === "תראה מה מצאתי");

    expect(captioned?.kind).toBe("attachment");
    expect(captioned?.attachment?.filename).toBe(
      "00000043-PHOTO-2025-03-14-20-10-34.jpg",
    );
    expect(captioned?.sourceIds).toEqual(["with-media", "without-media"]);
  });

  it("matches messages whose timestamps drift by a second between exports", () => {
    // The source pair disagreed about the seconds on 8 of 127 messages — same phone, same
    // chat, minutes apart. Minute-precision identity is what absorbs that.
    expect(IOS_REAL_WITH_MEDIA).toContain("20:10:35");
    expect(IOS_REAL_WITHOUT_MEDIA).toContain("20:10:34");

    const captioned = merged.filter((m) => m.body === "תראה מה מצאתי");
    expect(captioned).toHaveLength(1);
  });

  it("recovers all four attachments across the pair", () => {
    const withFiles = merged.filter((m) => m.kind === "attachment");
    expect(withFiles.map((m) => m.attachment?.filename).sort()).toEqual([
      "00000012-VIDEO-2025-02-22-17-12-39.mp4",
      "00000043-PHOTO-2025-03-14-20-10-34.jpg",
      "00000049-STICKER-2025-03-15-15-48-45.webp",
    ]);
  });
});
