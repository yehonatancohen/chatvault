import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWebCryptoProvider } from "../crypto/ports.js";
import { toHex } from "../crypto/sha256.js";
import type { ParsedMessage } from "../types.js";
import { linkMedia } from "./link.js";
import { InMemoryMediaSource, type MediaSource } from "./source.js";

/**
 * A real WebCrypto rather than a stub hash: the whole point of content addressing is that two
 * members' copies of one photo land on the same path, and a fake digest would let a bug in
 * the byte handling (a stray view offset, say) pass unnoticed.
 */
const crypto = createWebCryptoProvider(webcrypto.subtle, (array) =>
  webcrypto.getRandomValues(array),
);

const bytes = (...values: readonly number[]): Uint8Array => Uint8Array.from(values);

/** Blobs with distinct lengths, so a byte-count bug cannot cancel itself out. */
const PHOTO = bytes(1, 2, 3, 4);
const VIDEO = bytes(9, 9, 9, 9, 9, 9, 9);
const STICKER = bytes(7, 7);

const sha = async (data: Uint8Array): Promise<string> => toHex(await crypto.sha256(data));

let seq = 0;

function attachment(filename: string, id = `m${++seq}`): ParsedMessage {
  return {
    id,
    ts: 1_700_000_000_000,
    wallClock: "2025-03-14T20:10:34",
    sender: "Dana",
    body: "",
    kind: "attachment",
    attachment: { filename },
  };
}

function omitted(id = `m${++seq}`): ParsedMessage {
  return {
    id,
    ts: 1_700_000_000_000,
    wallClock: "2025-03-14T20:10:34",
    sender: "Ravid",
    body: "<Media omitted>",
    kind: "omitted-media",
  };
}

function text(id = `m${++seq}`): ParsedMessage {
  return {
    id,
    ts: 1_700_000_000_000,
    wallClock: "2025-03-14T20:10:34",
    sender: "Dana",
    body: "on my way",
    kind: "text",
  };
}

describe("linkMedia", () => {
  it("content-addresses one attachment", async () => {
    const source = InMemoryMediaSource.from({
      "00000043-PHOTO-2025-03-14-20-10-34.jpg": PHOTO,
    });
    const message = attachment("00000043-PHOTO-2025-03-14-20-10-34.jpg");

    const result = await linkMedia([message], source, crypto);

    expect(result.refs).toEqual([
      {
        sha256: await sha(PHOTO),
        byteLength: 4,
        filenames: ["00000043-PHOTO-2025-03-14-20-10-34.jpg"],
      },
    ]);
    expect(result.byMessageId.get(message.id)).toBe(await sha(PHOTO));
    expect(result.missing).toEqual([]);
    expect(result.unreferenced).toEqual([]);
  });

  it("collapses identical bytes under two filenames into one ref", async () => {
    // The case the whole design exists for: two members exported the same photo and their
    // devices named it differently.
    const source = InMemoryMediaSource.from({
      "00000043-PHOTO-2025-03-14-20-10-34.jpg": PHOTO,
      "IMG-20250314-WA0007.jpg": Uint8Array.from(PHOTO),
    });
    const ios = attachment("00000043-PHOTO-2025-03-14-20-10-34.jpg", "ios-1");
    const android = attachment("IMG-20250314-WA0007.jpg", "android-1");

    const result = await linkMedia([ios, android], source, crypto);

    expect(result.refs).toHaveLength(1);
    expect(result.refs[0]?.filenames).toEqual([
      "00000043-PHOTO-2025-03-14-20-10-34.jpg",
      "IMG-20250314-WA0007.jpg",
    ]);
    expect(result.byMessageId.get("ios-1")).toBe(result.byMessageId.get("android-1"));
  });

  it("keeps distinct bytes in distinct refs even at equal length", async () => {
    const source = InMemoryMediaSource.from({ a: bytes(1, 2), b: bytes(2, 1) });

    const result = await linkMedia(
      [attachment("a", "a-1"), attachment("b", "b-1")],
      source,
      crypto,
    );

    expect(result.refs).toHaveLength(2);
    expect(result.byMessageId.get("a-1")).not.toBe(result.byMessageId.get("b-1"));
  });

  it("reads and hashes each distinct filename exactly once", async () => {
    const reads: string[] = [];
    const inner = InMemoryMediaSource.from({ "shared.jpg": PHOTO });
    const counting: MediaSource = {
      list: () => inner.list(),
      read: (filename) => {
        reads.push(filename);
        return inner.read(filename);
      },
    };

    // Three messages, one file — a photo re-sent twice later in the chat.
    await linkMedia(
      [
        attachment("shared.jpg", "one"),
        text(),
        attachment("shared.jpg", "two"),
        attachment("shared.jpg", "three"),
      ],
      counting,
      crypto,
    );

    expect(reads).toEqual(["shared.jpg"]);
  });

  it("reports a referenced file the source does not hold, and does not throw", async () => {
    const source = InMemoryMediaSource.from({ "present.jpg": PHOTO });

    const result = await linkMedia(
      [attachment("present.jpg", "here"), attachment("gone.mp4", "lost")],
      source,
      crypto,
    );

    expect(result.missing).toEqual([
      { messageId: "lost", filename: "gone.mp4", reason: "absent" },
    ]);
    expect(result.refs).toHaveLength(1);
    // The surviving message still links; one bad file does not poison the import.
    expect(result.byMessageId.get("here")).toBe(await sha(PHOTO));
    expect(result.byMessageId.has("lost")).toBe(false);
  });

  it("reports a listed-but-unreadable file separately from an absent one", async () => {
    // A corrupt zip entry: `list()` sees the name, `read()` blows up on the bytes.
    const source: MediaSource = {
      list: () => Promise.resolve(["corrupt.jpg"]),
      read: () => Promise.reject(new Error("bad CRC")),
    };

    const result = await linkMedia([attachment("corrupt.jpg", "x")], source, crypto);

    expect(result.missing).toEqual([
      { messageId: "x", filename: "corrupt.jpg", reason: "unreadable" },
    ]);
    expect(result.refs).toEqual([]);
    expect(result.unreferenced).toEqual([]);
  });

  it("names every message that referenced a missing file", async () => {
    const result = await linkMedia(
      [attachment("gone.jpg", "b"), attachment("gone.jpg", "a")],
      new InMemoryMediaSource(),
      crypto,
    );

    expect(result.missing.map((m) => m.messageId)).toEqual(["a", "b"]);
  });

  it("reports files no message referenced", async () => {
    // `_chat.txt` is the platform's to filter, but a leaked one must still surface here
    // rather than being silently swallowed.
    const source = InMemoryMediaSource.from({
      "used.jpg": PHOTO,
      "orphan.mp4": VIDEO,
      "_chat.txt": bytes(60),
    });

    const result = await linkMedia([attachment("used.jpg")], source, crypto);

    expect(result.unreferenced).toEqual(["_chat.txt", "orphan.mp4"]);
    expect(result.refs).toHaveLength(1);
  });

  it("handles an export that mixes attachments and omitted media", async () => {
    const source = InMemoryMediaSource.from({
      "00000043-PHOTO-2025-03-14-20-10-34.jpg": PHOTO,
      "00000049-STICKER-2025-03-15-15-48-45.webp": STICKER,
      "00000056-VIDEO-2025-03-20-18-07-03.mp4": VIDEO,
    });
    const messages = [
      attachment("00000043-PHOTO-2025-03-14-20-10-34.jpg"),
      omitted(),
      text(),
      attachment("00000049-STICKER-2025-03-15-15-48-45.webp"),
      omitted(),
      attachment("00000056-VIDEO-2025-03-20-18-07-03.mp4"),
    ];

    const result = await linkMedia(messages, source, crypto);

    // An omitted message carries no filename, so it can be neither linked nor missing.
    expect(result.refs).toHaveLength(3);
    expect(result.byMessageId.size).toBe(3);
    expect(result.missing).toEqual([]);
    expect(result.unreferenced).toEqual([]);
  });

  it("ignores an `attachment` message with no attachment field", async () => {
    // Structurally reachable because `attachment` is optional on `ParsedMessage`.
    // `exactOptionalPropertyTypes` forbids writing `attachment: undefined`, so it is omitted.
    const broken: ParsedMessage = {
      id: "broken",
      ts: 1_700_000_000_000,
      wallClock: "2025-03-14T20:10:34",
      sender: "Dana",
      body: "",
      kind: "attachment",
    };

    const result = await linkMedia([broken], new InMemoryMediaSource(), crypto);

    expect(result.refs).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.byMessageId.size).toBe(0);
  });

  it("returns empty results for an export with no messages and no media", async () => {
    const result = await linkMedia([], new InMemoryMediaSource(), crypto);

    expect(result).toEqual({
      refs: [],
      byMessageId: new Map(),
      missing: [],
      unreferenced: [],
    });
  });

  it("returns a text-only export unchanged and reports nothing", async () => {
    const result = await linkMedia([text(), text()], new InMemoryMediaSource(), crypto);

    expect(result.refs).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it("sorts refs by hash and filenames within a ref, independent of message order", async () => {
    const files = { one: PHOTO, two: Uint8Array.from(PHOTO), three: VIDEO, four: STICKER };
    const forwards = await linkMedia(
      [attachment("one"), attachment("two"), attachment("three"), attachment("four")],
      InMemoryMediaSource.from(files),
      crypto,
    );
    const backwards = await linkMedia(
      [attachment("four"), attachment("three"), attachment("two"), attachment("one")],
      InMemoryMediaSource.from(files),
      crypto,
    );

    expect(forwards.refs).toEqual(backwards.refs);
    const hashes = forwards.refs.map((r) => r.sha256);
    expect(hashes).toEqual([...hashes].sort());
  });

  it("hashes the plaintext, matching what the archive writer would store", async () => {
    const expected = toHex(
      new Uint8Array(await webcrypto.subtle.digest("SHA-256", Uint8Array.from(VIDEO))),
    );

    const result = await linkMedia(
      [attachment("v.mp4")],
      InMemoryMediaSource.from({ "v.mp4": VIDEO }),
      crypto,
    );

    expect(result.refs[0]?.sha256).toBe(expected);
    expect(result.refs[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("InMemoryMediaSource", () => {
  it("rejects rather than resolving undefined for an unknown name", async () => {
    await expect(new InMemoryMediaSource().read("nope.jpg")).rejects.toThrow(/nope\.jpg/);
  });

  it("hands out a copy, so a caller cannot mutate the source", async () => {
    const source = InMemoryMediaSource.from({ "a.jpg": PHOTO });
    const first = await source.read("a.jpg");
    first.set([0xff], 0);

    expect(await source.read("a.jpg")).toEqual(PHOTO);
  });
});
