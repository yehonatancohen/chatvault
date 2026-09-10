import { describe, expect, it } from "vitest";
import type { MediaRef, MergedMessage } from "@chatvault/core";
import { buildMediaIndex, imagesOnly, initialsFor, pickChatThumbnail } from "./media-index";

let counter = 0;
function attachment(
  filename: string,
  sha256: string | undefined,
  ts: number,
  sender = "Dana",
): MergedMessage {
  counter += 1;
  return {
    id: `m${counter}`,
    ts,
    wallClock: "2025-03-14T20:10:00",
    sender,
    body: "",
    kind: "attachment",
    attachment: sha256 === undefined ? { filename } : { filename, sha256 },
    sourceIds: ["s1"],
  } as MergedMessage;
}

function text(ts: number): MergedMessage {
  counter += 1;
  return {
    id: `t${counter}`,
    ts,
    wallClock: "2025-03-14T20:10:00",
    sender: "Dana",
    body: "hello",
    kind: "text",
    sourceIds: ["s1"],
  } as MergedMessage;
}

const ref = (sha256: string, byteLength: number, ...filenames: string[]): MediaRef => ({
  sha256,
  byteLength,
  filenames,
});

describe("buildMediaIndex", () => {
  it("takes the date and sender from the message, since a ref has neither", () => {
    const items = buildMediaIndex(
      [attachment("a.jpg", "hash-a", 1000, "Yonatan")],
      [ref("hash-a", 500, "a.jpg")],
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sha256: "hash-a", ts: 1000, sender: "Yonatan", byteLength: 500 });
  });

  it("orders newest first", () => {
    const items = buildMediaIndex(
      [
        attachment("old.jpg", "hash-old", 1000),
        attachment("new.jpg", "hash-new", 3000),
        attachment("mid.jpg", "hash-mid", 2000),
      ],
      [ref("hash-old", 1, "old.jpg"), ref("hash-new", 1, "new.jpg"), ref("hash-mid", 1, "mid.jpg")],
    );

    expect(items.map((i) => i.sha256)).toEqual(["hash-new", "hash-mid", "hash-old"]);
  });

  it("credits a blob to the first message that used it, not a later forward", () => {
    const items = buildMediaIndex(
      [
        attachment("photo.jpg", "hash", 1000, "Dana"),
        attachment("forwarded.jpg", "hash", 9000, "Yonatan"),
      ],
      [ref("hash", 1, "photo.jpg", "forwarded.jpg")],
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ ts: 1000, sender: "Dana" });
  });

  it("skips media the archive does not actually hold", () => {
    // The gallery shows what is here. The gap is reported on Verify and in chat info, and a
    // grid of broken tiles would be a worse way to say it.
    const items = buildMediaIndex(
      [attachment("here.jpg", "hash-here", 1000), attachment("gone.jpg", "hash-gone", 2000)],
      [ref("hash-here", 1, "here.jpg")],
    );

    expect(items.map((i) => i.sha256)).toEqual(["hash-here"]);
  });

  it("ignores attachments with no content address at all", () => {
    expect(buildMediaIndex([attachment("unresolved.jpg", undefined, 1000)], [])).toEqual([]);
  });

  it("ignores non-attachment messages", () => {
    expect(buildMediaIndex([text(1000)], [])).toEqual([]);
  });

  it("classifies kinds from the filename", () => {
    const items = buildMediaIndex(
      [
        attachment("a.jpg", "h1", 1000),
        attachment("b.mp4", "h2", 2000),
        attachment("c.opus", "h3", 3000),
        attachment("d.pdf", "h4", 4000),
      ],
      [ref("h1", 1), ref("h2", 1), ref("h3", 1), ref("h4", 1)],
    );

    expect(items.map((i) => i.kind)).toEqual(["other", "audio", "video", "image"]);
    expect(imagesOnly(items).map((i) => i.filename)).toEqual(["a.jpg"]);
  });
});

describe("pickChatThumbnail", () => {
  it("chooses the smallest image, because this runs while a list renders", () => {
    const items = buildMediaIndex(
      [
        attachment("big.jpg", "big", 3000),
        attachment("small.jpg", "small", 1000),
        attachment("video.mp4", "vid", 4000),
      ],
      [ref("big", 900_000, "big.jpg"), ref("small", 4_000, "small.jpg"), ref("vid", 10, "video.mp4")],
    );

    expect(pickChatThumbnail(items)?.sha256).toBe("small");
  });

  it("returns nothing when the chat has no images", () => {
    const items = buildMediaIndex([attachment("v.mp4", "vid", 1000)], [ref("vid", 10, "v.mp4")]);
    expect(pickChatThumbnail(items)).toBeUndefined();
  });
});

describe("initialsFor", () => {
  it("takes one letter from a single-word title", () => {
    expect(initialsFor("Dana")).toBe("D");
  });

  it("takes the first and last word of a longer name", () => {
    expect(initialsFor("Anna Marie Smith")).toBe("AS");
  });

  it("handles Hebrew", () => {
    expect(initialsFor("דנה כהן")).toBe("דכ");
  });

  it("does not split an emoji into a replacement character", () => {
    // charAt(0) on an astral character returns half a surrogate pair and renders as a box.
    expect(initialsFor("🎉 Party")).toBe("🎉P");
  });

  it("falls back rather than rendering an empty circle", () => {
    expect(initialsFor("   ")).toBe("?");
  });
});
