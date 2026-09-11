import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";

import { MemoryStorageAdapter } from "../../../storage/src/memory.js";
import { createWebCryptoProvider } from "../crypto/ports.js";
import {
  aadFor,
  assertReadableVersion,
  FORMAT_VERSION,
  HEADER_PATH,
  KeyRequiredError,
  PLAIN_FORMAT_VERSION,
  PLAIN_MANIFEST_PATH,
  SEALED_FORMAT_VERSION,
  TRANSCRIPT_PATH,
  type Manifest,
} from "./format.js";
import { ArchiveReader } from "./reader.js";
import { batch, content, message, testKey, testKeyWrapping, testSource } from "./testing.js";
import { renderTranscript } from "./transcript.js";
import { ArchiveWriter } from "./writer.js";

/**
 * Plain (unprotected) archives — the default since encryption became opt-in.
 *
 * The properties that matter: the files are readable by anything, a copy opens with no key,
 * an append never changes an archive's kind, and nothing here disturbs sealed archives —
 * whose AAD must stay bound to version 1 or every existing archive stops opening.
 */

const crypto = createWebCryptoProvider(webcrypto.subtle, (array) => webcrypto.getRandomValues(array));
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const photo = Uint8Array.from({ length: 64 }, (_, i) => i);

const plainWriter = (storage: MemoryStorageAdapter) =>
  new ArchiveWriter({ crypto, storage, archiveId: "arch-1", now: () => 1_700_000_000_000 });

describe("plain archives", () => {
  it("are ordinary files: JSON, JSONL, the photo with its extension, and chat.txt", async () => {
    const storage = new MemoryStorageAdapter();
    await plainWriter(storage).write(
      content({
        batches: [
          batch("s1", [
            message(0, "Dana", "see you at the pier"),
            { ...message(1, "Ravid", ""), kind: "attachment", attachment: { filename: "IMG-0001.JPG" } },
          ]),
        ],
        media: [{ filename: "IMG-0001.JPG", read: async () => photo }],
      }),
    );

    const paths = (await storage.list("")).sort();
    const mediaFile = paths.find((p) => p.startsWith("media/"));
    expect(mediaFile).toMatch(/^media\/[0-9a-f]{64}\.jpg$/);
    expect(paths).toEqual(
      ["chat.txt", "chunks/0.jsonl", "header.json", "index.json", "manifest.json", mediaFile!].sort(),
    );

    const header = JSON.parse(decode(await storage.get(HEADER_PATH))) as Record<string, unknown>;
    expect(header).toEqual({
      formatVersion: PLAIN_FORMAT_VERSION,
      archiveId: "arch-1",
      createdAt: 1_700_000_000_000,
      encryption: "none",
    });
    const manifest = JSON.parse(decode(await storage.get(PLAIN_MANIFEST_PATH))) as Manifest;
    expect(manifest.messageCount).toBe(2);
    expect(decode(await storage.get("chunks/0.jsonl"))).toContain("see you at the pier");
    expect(await storage.get(mediaFile!)).toEqual(photo);
    expect(decode(await storage.get(TRANSCRIPT_PATH))).toContain("Dana: see you at the pier");
  });

  it("open with no key, and read back", async () => {
    const storage = new MemoryStorageAdapter();
    const written = await plainWriter(storage).write(
      content({ media: [{ filename: "IMG-0001.jpg", read: async () => photo }] }),
    );

    const reader = await ArchiveReader.open({ crypto, storage, archiveId: "arch-1" });
    expect(reader.encrypted).toBe(false);
    expect((await reader.readAll()).map((m) => m.body)).toEqual(["first", "second"]);
    expect(await reader.readMedia(written.media[0]!.sha256)).toEqual(photo);
  });

  it("stay plain when appended to, even if the caller offers a key", async () => {
    const storage = new MemoryStorageAdapter();
    await plainWriter(storage).write(content());
    await new ArchiveWriter({
      crypto,
      storage,
      archiveId: "arch-1",
      key: testKey(),
      keyWrapping: testKeyWrapping,
    }).append(content({ sources: [testSource("s2")], batches: [batch("s2", [message(9, "Noa", "later")])] }));

    const reader = await ArchiveReader.open({ crypto, storage, archiveId: "arch-1" });
    expect(reader.encrypted).toBe(false);
    expect((await reader.readAll()).map((m) => m.body)).toContain("later");
    expect(decode(await storage.get(TRANSCRIPT_PATH))).toContain("Noa: later");
  });

  it("keep a photo at the path it was first stored under when a later export renames it", async () => {
    const storage = new MemoryStorageAdapter();
    const first = await plainWriter(storage).write(
      content({ media: [{ filename: "IMG-0001.jpg", read: async () => photo }] }),
    );
    const again = await plainWriter(storage).append(
      content({
        sources: [testSource("s2")],
        media: [{ filename: "00000043-PHOTO-2025-03-14.jpeg", read: async () => photo }],
      }),
    );

    expect(again.media).toHaveLength(1);
    expect(again.media[0]?.path).toBe(first.media[0]?.path);
    expect(again.media[0]?.filenames).toHaveLength(2);
    expect((await storage.list("media/")).length).toBe(1);
  });

  it("absorb the same export twice without change", async () => {
    const storage = new MemoryStorageAdapter();
    const once = await plainWriter(storage).write(content());
    const twice = await plainWriter(storage).append(content());
    expect(twice.chunks).toEqual(once.chunks);
    expect(twice.messageCount).toBe(once.messageCount);
  });

  it("are readable by this build, and flagged as newer than a sealed-only build", () => {
    expect(PLAIN_FORMAT_VERSION).toBeGreaterThan(SEALED_FORMAT_VERSION);
    expect(() => assertReadableVersion({ formatVersion: PLAIN_FORMAT_VERSION })).not.toThrow();
    expect(FORMAT_VERSION).toBe(PLAIN_FORMAT_VERSION);
  });
});

describe("sealed archives, unchanged", () => {
  it("still bind every payload to version 1 — the AAD every existing archive was sealed with", () => {
    expect(decode(aadFor("arch-1", "manifest.json.enc"))).toBe("cvault/1/arch-1/manifest.json.enc");
  });

  it("refuse to open or append without the key", async () => {
    const storage = new MemoryStorageAdapter();
    await new ArchiveWriter({
      crypto,
      storage,
      archiveId: "arch-1",
      key: testKey(),
      keyWrapping: testKeyWrapping,
    }).write(content());

    await expect(ArchiveReader.open({ crypto, storage, archiveId: "arch-1" })).rejects.toThrow(KeyRequiredError);
    await expect(plainWriter(storage).append(content())).rejects.toThrow(KeyRequiredError);
  });

  it("refuse a key without its wrapping, rather than writing an archive no passphrase opens", async () => {
    const storage = new MemoryStorageAdapter();
    await expect(
      new ArchiveWriter({ crypto, storage, archiveId: "arch-1", key: testKey() }).write(content()),
    ).rejects.toThrow(/both key and keyWrapping/);
  });
});

describe("renderTranscript", () => {
  it("reads like WhatsApp's own export, with media pointing at its file", () => {
    const text = renderTranscript(
      "Trip",
      [
        { ...message(0, "Dana", "hi"), sourceIds: ["s1"] },
        {
          ...message(1, "Ravid", "look"),
          kind: "attachment",
          attachment: { filename: "IMG.jpg", sha256: "abc" },
          sourceIds: ["s1"],
        },
        { ...message(2, "Noa", ""), kind: "omitted-media", sourceIds: ["s1"] },
      ],
      new Map([["abc", "media/abc.jpg"]]),
    );
    expect(text).toBe(
      "Trip\n\n" +
        "15/03/2024, 09:00 - Dana: hi\n" +
        "15/03/2024, 09:01 - Ravid: [photo: media/abc.jpg] look\n" +
        "15/03/2024, 09:02 - Noa: [media not saved]\n",
    );
  });
});

describe("previews (thumbs/)", () => {
  const preview = async (bytes: Uint8Array) => bytes.slice(0, 8);
  const video = Uint8Array.from({ length: 64 }, (_, i) => 255 - i);

  it("are added for photos only, readable back, and never added twice", async () => {
    const storage = new MemoryStorageAdapter();
    const manifest = await plainWriter(storage).write(
      content({
        media: [
          { filename: "IMG-0001.jpg", read: async () => photo },
          { filename: "VID-0001.mp4", read: async () => video },
        ],
      }),
    );

    expect(await plainWriter(storage).addMissingThumbnails(preview)).toBe(1);
    expect(await plainWriter(storage).addMissingThumbnails(preview)).toBe(0);

    const reader = await ArchiveReader.open({ crypto, storage, archiveId: "arch-1" });
    const photoRef = manifest.media.find((m) => m.filenames[0] === "IMG-0001.jpg")!;
    const videoRef = manifest.media.find((m) => m.filenames[0] === "VID-0001.mp4")!;
    expect(await reader.readThumbnail(photoRef.sha256)).toEqual(photo.slice(0, 8));
    expect(await reader.readThumbnail(videoRef.sha256)).toBeUndefined();
    expect(await storage.has(`thumbs/${photoRef.sha256}.jpg`)).toBe(true);
  });

  it("are sealed in a protected archive", async () => {
    const storage = new MemoryStorageAdapter();
    const sealed = () =>
      new ArchiveWriter({ crypto, storage, archiveId: "arch-1", key: testKey(), keyWrapping: testKeyWrapping });
    const manifest = await sealed().write(content({ media: [{ filename: "IMG-0001.jpg", read: async () => photo }] }));
    await sealed().addMissingThumbnails(preview);

    const sha = manifest.media[0]!.sha256;
    const stored = await storage.get(`thumbs/${sha}.enc`);
    expect(stored).not.toEqual(photo.slice(0, 8));
    const reader = await ArchiveReader.open({ crypto, storage, archiveId: "arch-1", key: testKey() });
    expect(await reader.readThumbnail(sha)).toEqual(photo.slice(0, 8));
  });

  it("carry on past a photo that cannot be previewed", async () => {
    const storage = new MemoryStorageAdapter();
    const other = Uint8Array.from({ length: 64 }, (_, i) => (i * 7) & 0xff);
    await plainWriter(storage).write(
      content({
        media: [
          { filename: "broken.jpg", read: async () => photo },
          { filename: "fine.jpg", read: async () => other },
        ],
      }),
    );
    const flaky = async (bytes: Uint8Array) => {
      if (bytes[1] === photo[1]) throw new Error("cannot decode");
      return bytes.slice(0, 4);
    };
    expect(await plainWriter(storage).addMissingThumbnails(flaky)).toBe(1);
  });

  it("are simply absent from an archive that has none", async () => {
    const storage = new MemoryStorageAdapter();
    const manifest = await plainWriter(storage).write(content({ media: [{ filename: "a.jpg", read: async () => photo }] }));
    const reader = await ArchiveReader.open({ crypto, storage, archiveId: "arch-1" });
    expect(await reader.readThumbnail(manifest.media[0]!.sha256)).toBeUndefined();
  });
});
