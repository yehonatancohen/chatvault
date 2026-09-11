import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";

import { MemoryStorageAdapter } from "../../../storage/src/memory.js";
import { createWebCryptoProvider, IV_LENGTH } from "../crypto/ports.js";
import { toHex } from "../crypto/sha256.js";
import { mergeBatches } from "../merge.js";
import {
  aadFor,
  chunkPath,
  decodeSealed,
  SEALED_FORMAT_VERSION,
  HEADER_PATH,
  INDEX_PATH,
  MANIFEST_PATH,
  mediaPath,
  type ArchiveHeader,
  type ArchiveIndex,
  type Manifest,
} from "./format.js";
import { readHeader } from "./reader.js";
import { batch, content, message, testKey, testKeyWrapping, testSource } from "./testing.js";
import {
  ArchiveExistsError,
  ArchiveWriter,
  MissingHeaderError,
  type ArchiveWriterOptions,
} from "./writer.js";

/**
 * A real WebCrypto, not a stub. The provider is the one piece of this package whose failure
 * mode is silent (a wrong nonce or a dropped AAD still produces bytes), so every assertion
 * here is made against actual AES-GCM output.
 */
const crypto = createWebCryptoProvider(webcrypto.subtle, (array) =>
  webcrypto.getRandomValues(array),
);

const setup = (overrides: Partial<ArchiveWriterOptions> = {}) => {
  const storage = new MemoryStorageAdapter();
  const writer = new ArchiveWriter({
    crypto,
    storage,
    key: testKey(),
    archiveId: "arch-1",
    keyWrapping: testKeyWrapping,
    now: () => 1_700_000_000_000,
    ...overrides,
  });
  return { storage, writer };
};

const openJson = async (
  storage: MemoryStorageAdapter,
  path: string,
  key = testKey(),
): Promise<unknown> => {
  const sealed = decodeSealed(await storage.get(path), path);
  const plaintext = await crypto.open(key, sealed, aadFor("arch-1", path));
  return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
};

describe("ArchiveWriter", () => {
  it("writes a manifest, one chunk and an index", async () => {
    const { storage, writer } = setup();

    const manifest = await writer.write(content());

    expect(await storage.list("")).toEqual(
      expect.arrayContaining([HEADER_PATH, MANIFEST_PATH, INDEX_PATH, chunkPath(0)]),
    );
    expect(manifest.formatVersion).toBe(SEALED_FORMAT_VERSION);
    expect(manifest.messageCount).toBe(2);
    expect(manifest.chunks).toHaveLength(1);
    expect(manifest.chunks[0]?.messageCount).toBe(2);
    expect(await openJson(storage, MANIFEST_PATH)).toEqual(manifest);
  });

  describe("the cleartext header", () => {
    const readHeaderJson = async (storage: MemoryStorageAdapter): Promise<string> =>
      new TextDecoder().decode(await storage.get(HEADER_PATH));

    it("copies key wrapping into it without interpreting it", async () => {
      const { storage, writer } = setup();
      await writer.write(content());

      const header = JSON.parse(await readHeaderJson(storage)) as ArchiveHeader;
      expect(header).toEqual({
        formatVersion: SEALED_FORMAT_VERSION,
        archiveId: "arch-1",
        createdAt: 1_700_000_000_000,
        keyWrapping: testKeyWrapping,
      });
    });

    it("is readable with no key at all", async () => {
      const { storage, writer } = setup();
      await writer.write(content());

      // No `crypto`, no key: this is the call a client makes before it has derived anything.
      expect(await readHeader(storage, "arch-1")).toMatchObject({ archiveId: "arch-1" });
    });

    it("contains nothing about the chat and no unwrapped key", async () => {
      const { storage, writer } = setup();
      await writer.write(
        content({
          chatTitle: "Trip planning",
          participants: [{ id: "p1", displayName: "Dana", aliases: ["+972 50-123-4567"] }],
          batches: [batch("s1", [message(0, "Dana", "meet at the pier")])],
        }),
      );

      const raw = await readHeaderJson(storage);
      // Cleartext means every one of these strings would be readable by anyone holding the
      // storage. The header's whole justification is that it says nothing about the chat.
      for (const secret of [
        "Trip planning",
        "Dana",
        "+972 50-123-4567",
        "meet at the pier",
        toHex(testKey()),
      ]) {
        expect(raw).not.toContain(secret);
      }
      expect(Object.keys(JSON.parse(raw) as ArchiveHeader).sort()).toEqual([
        "archiveId",
        "createdAt",
        "formatVersion",
        "keyWrapping",
      ]);
    });

    it("is left byte-identical by an append", async () => {
      const { storage, writer } = setup();
      await writer.write(content());
      const before = await storage.get(HEADER_PATH);

      // A rewrap here would silently invalidate the passphrase the user already wrote down.
      const rewrapping = new ArchiveWriter({
        crypto,
        storage,
        key: testKey(),
        archiveId: "arch-1",
        keyWrapping: { ...testKeyWrapping, iterations: 1, saltBase64: "b3RoZXItc2FsdA==" },
      });
      await rewrapping.append(
        content({ sources: [testSource("s2")], batches: [batch("s2", [message(9, "R", "x")])] }),
      );

      expect(await storage.get(HEADER_PATH)).toEqual(before);
    });

    it("refuses to append to an archive that has none", async () => {
      const { storage, writer } = setup();
      await writer.write(content());
      await storage.remove(HEADER_PATH);

      await expect(writer.append(content())).rejects.toThrow(MissingHeaderError);
    });
  });

  it("records the ciphertext hash, not the plaintext hash, in each ChunkRef", async () => {
    const { storage, writer } = setup();
    const manifest = await writer.write(content());

    const stored = await storage.get(chunkPath(0));
    const ciphertext = stored.slice(IV_LENGTH);
    // Hashed independently of our own code path, and over the ciphertext only: an integrity
    // checker holding no key must be able to reproduce this from the stored object alone.
    const expected = toHex(
      new Uint8Array(await webcrypto.subtle.digest("SHA-256", ciphertext)),
    );

    expect(manifest.chunks[0]?.sha256).toBe(expected);
  });

  it("splits at the chunk boundary and keeps merge order across chunks", async () => {
    const { storage, writer } = setup({ messagesPerChunk: 3 });
    const messages = Array.from({ length: 7 }, (_, i) => message(i, "Dana", `m${i}`));

    const manifest = await writer.write(content({ batches: [batch("s1", messages)] }));

    expect(manifest.chunks.map((c) => c.messageCount)).toEqual([3, 3, 1]);
    expect(manifest.chunks.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(manifest.firstTs).toBe(messages[0]?.ts);
    expect(manifest.lastTs).toBe(messages[6]?.ts);
    expect(await storage.has(chunkPath(3))).toBe(false);

    const index = (await openJson(storage, INDEX_PATH)) as ArchiveIndex;
    const merged = mergeBatches([batch("s1", messages)]);
    expect(index[merged[0]!.id]).toBe(0);
    expect(index[merged[4]!.id]).toBe(1);
    expect(index[merged[6]!.id]).toBe(2);
  });

  it("reports a zero range for an archive with no messages", async () => {
    const { writer } = setup();
    const manifest = await writer.write(content({ batches: [] }));
    expect(manifest).toMatchObject({ messageCount: 0, chunks: [], firstTs: 0, lastTs: 0 });
  });

  describe("media", () => {
    const photo = Uint8Array.from({ length: 64 }, (_, i) => i);

    it("stores one blob for two filenames and lists both", async () => {
      const { storage, writer } = setup();

      const manifest = await writer.write(
        content({
          media: [
            { filename: "IMG-0001.jpg", read: async () => photo },
            { filename: "IMG-20240315-WA0007.jpg", read: async () => photo },
          ],
        }),
      );

      expect(await storage.list("media/")).toHaveLength(1);
      expect(manifest.media).toHaveLength(1);
      expect(manifest.media[0]?.filenames).toEqual([
        "IMG-0001.jpg",
        "IMG-20240315-WA0007.jpg",
      ]);
      expect(manifest.media[0]?.byteLength).toBe(64);
    });

    it("addresses a blob by its plaintext hash", async () => {
      const { storage, writer } = setup();
      const manifest = await writer.write(
        content({ media: [{ filename: "a.jpg", read: async () => photo }] }),
      );

      const expected = toHex(new Uint8Array(await webcrypto.subtle.digest("SHA-256", photo)));
      expect(manifest.media[0]?.sha256).toBe(expected);
      expect(await storage.has(mediaPath(expected))).toBe(true);
    });

    it("does not re-seal a blob it has already stored", async () => {
      const { storage, writer } = setup();
      await writer.write(content({ media: [{ filename: "a.jpg", read: async () => photo }] }));

      const hash = toHex(await crypto.sha256(photo));
      const first = await storage.get(mediaPath(hash));

      await writer.append(
        content({
          sources: [testSource("s2")],
          batches: [batch("s2", [message(5, "Ravid", "later")])],
          media: [{ filename: "b.jpg", read: async () => photo }],
        }),
      );

      // Object *count* alone would pass even if the blob were re-sealed, since the content
      // address makes the second write land on the same path with a fresh IV. Byte identity
      // is what proves the `has()` short-circuit actually ran.
      expect(await storage.get(mediaPath(hash))).toEqual(first);
      expect(await storage.list("media/")).toHaveLength(1);
    });

    it("reads one blob at a time and does not hold them", async () => {
      // The property `MediaBlob.read` exists for: peak memory is one blob, not all of them.
      // Counting concurrent reads is the only way to state that as a test.
      const { writer } = setup();
      let live = 0;
      let peak = 0;
      const lazy = (filename: string, bytes: Uint8Array) => ({
        filename,
        read: async () => {
          live += 1;
          peak = Math.max(peak, live);
          await Promise.resolve();
          live -= 1;
          return bytes;
        },
      });

      await writer.write(
        content({
          media: [
            lazy("a.jpg", photo),
            lazy("b.jpg", Uint8Array.from(photo, (b) => b ^ 0xff)),
            lazy("c.jpg", Uint8Array.from(photo, (b) => (b + 1) & 0xff)),
          ],
        }),
      );

      expect(peak).toBe(1);
    });

    it("does not read a blob the archive already holds", async () => {
      // With the content address supplied, re-importing an export must not inflate a single
      // byte of media to discover it is all already stored.
      const { writer } = setup();
      const hash = toHex(await crypto.sha256(photo));

      await writer.write(content({ media: [{ filename: "a.jpg", read: async () => photo }] }));

      let reads = 0;
      await writer.append(
        content({
          sources: [testSource("s2")],
          batches: [batch("s2", [message(5, "Ravid", "later")])],
          media: [
            {
              filename: "a.jpg",
              sha256: hash,
              read: async () => {
                reads += 1;
                return photo;
              },
            },
          ],
        }),
      );

      expect(reads).toBe(0);
    });

    it("still records a new filename for a blob it did not read", async () => {
      const { writer } = setup();
      const hash = toHex(await crypto.sha256(photo));
      await writer.write(content({ media: [{ filename: "a.jpg", read: async () => photo }] }));

      const manifest = await writer.append(
        content({
          media: [{ filename: "b.jpg", sha256: hash, read: async () => photo }],
        }),
      );

      expect(manifest.media).toHaveLength(1);
      expect(manifest.media[0]?.filenames).toEqual(["a.jpg", "b.jpg"]);
    });

    it("hashes a blob itself when the caller supplies no address", async () => {
      const { storage, writer } = setup();
      const manifest = await writer.write(
        content({ media: [{ filename: "a.jpg", read: async () => photo }] }),
      );

      const expected = toHex(await crypto.sha256(photo));
      expect(manifest.media[0]?.sha256).toBe(expected);
      expect(await storage.has(mediaPath(expected))).toBe(true);
    });

    it("accumulates filenames across appends", async () => {
      const { writer } = setup();
      await writer.write(content({ media: [{ filename: "a.jpg", read: async () => photo }] }));
      const manifest = await writer.append(
        content({ media: [{ filename: "b.jpg", read: async () => photo }] }),
      );

      expect(manifest.media).toHaveLength(1);
      expect(manifest.media[0]?.filenames).toEqual(["a.jpg", "b.jpg"]);
    });
  });

  describe("append", () => {
    it("leaves an unchanged chunk's bytes alone", async () => {
      const { storage, writer } = setup({ messagesPerChunk: 2 });
      const first = [message(0, "Dana", "a"), message(1, "Dana", "b")];
      await writer.write(content({ batches: [batch("s1", first)] }));
      const chunkZero = await storage.get(chunkPath(0));

      const manifest = await writer.append(
        content({
          sources: [testSource("s2")],
          batches: [batch("s2", [message(9, "Ravid", "c"), message(10, "Ravid", "d")])],
        }),
      );

      expect(await storage.get(chunkPath(0))).toEqual(chunkZero);
      expect(manifest.chunks).toHaveLength(2);
      expect(manifest.messageCount).toBe(4);
    });

    it("refuses a second fresh write over an existing archive", async () => {
      const { writer } = setup();
      await writer.write(content());

      // Rewriting from scratch would leave the first write's media unreferenced but still
      // stored, and nothing here is allowed to delete it. So the second write is an error.
      await expect(writer.write(content())).rejects.toThrow(ArchiveExistsError);
    });

    it("rewrites a chunk whose messages gained a source", async () => {
      const { storage, writer } = setup();
      const shared = [message(0, "Dana", "a"), message(1, "Dana", "b")];
      await writer.write(content({ batches: [batch("s1", shared)] }));
      const before = await storage.get(chunkPath(0));

      // Same message ids, richer content: `sourceIds` now names two contributors. A reuse
      // check that compared ids would skip this write and lose the attribution.
      const manifest = await writer.append(
        content({ sources: [testSource("s2")], batches: [batch("s2", shared)] }),
      );

      expect(await storage.get(chunkPath(0))).not.toEqual(before);
      expect(manifest.messageCount).toBe(2);
      expect(manifest.chunks[0]?.sha256).not.toBe("");
    });

    it("keeps createdAt but advances updatedAt", async () => {
      const storage = new MemoryStorageAdapter();
      const options = {
        crypto,
        storage,
        key: testKey(),
        archiveId: "arch-1",
        keyWrapping: testKeyWrapping,
      };
      const created = await new ArchiveWriter({ ...options, now: () => 1_000 }).write(content());
      const appended = await new ArchiveWriter({ ...options, now: () => 2_000 }).append(
        content({ sources: [testSource("s2")], batches: [batch("s2", [message(3, "R", "x")])] }),
      );

      expect(appended.createdAt).toBe(created.createdAt);
      expect(appended.updatedAt).toBe(2_000);
    });

    it("does not duplicate a source or a participant on re-import", async () => {
      const { writer } = setup();
      await writer.write(content());
      const manifest = await writer.append(content());

      expect(manifest.sources.map((s) => s.id)).toEqual(["s1"]);
      expect(manifest.participants).toHaveLength(1);
      expect(manifest.messageCount).toBe(2);
    });

    it("unions participant aliases rather than replacing them", async () => {
      const { writer } = setup();
      await writer.write(content());
      const manifest = await writer.append(
        content({ participants: [{ id: "p1", displayName: "Dana C", aliases: ["Dana Cohen"] }] }),
      );

      expect(manifest.participants[0]).toEqual({
        id: "p1",
        displayName: "Dana C",
        aliases: ["+972 50-123-4567", "Dana Cohen"],
      });
    });

    it("keeps the key wrapping out of the sealed manifest entirely", async () => {
      const { storage, writer } = setup();
      await writer.write(content());

      // It lives in the header now. Leaving a stale copy here would be a second source of
      // truth for the one thing a user cannot afford to have two answers for.
      expect(await openJson(storage, MANIFEST_PATH)).not.toHaveProperty("keyWrapping");
    });
  });

  it("binds every payload to its own path", async () => {
    const { storage, writer } = setup({ messagesPerChunk: 1 });
    await writer.write(
      content({ batches: [batch("s1", [message(0, "Dana", "a"), message(1, "Dana", "b")])] }),
    );

    const sealedOne = decodeSealed(await storage.get(chunkPath(1)), chunkPath(1));
    // Chunk 1's bytes, presented as chunk 0: same archive, same key, wrong path.
    await expect(
      crypto.open(testKey(), sealedOne, aadFor("arch-1", chunkPath(0))),
    ).rejects.toThrow();
    await expect(
      crypto.open(testKey(), sealedOne, aadFor("arch-2", chunkPath(1))),
    ).rejects.toThrow();
  });

  it("writes nothing a wrong key can open", async () => {
    const { storage, writer } = setup();
    await writer.write(content());
    await expect(openJson(storage, MANIFEST_PATH, testKey(9))).rejects.toThrow();
  });

  it("produces a manifest whose chunk refs describe the real message ranges", async () => {
    const { writer } = setup({ messagesPerChunk: 2 });
    const messages = [
      message(0, "Dana", "a"),
      message(1, "Dana", "b"),
      message(2, "Ravid", "c"),
    ];
    const manifest: Manifest = await writer.write(content({ batches: [batch("s1", messages)] }));
    const merged = mergeBatches([batch("s1", messages)]);

    expect(manifest.chunks[0]?.firstTs).toBe(merged[0]!.ts);
    expect(manifest.chunks[0]?.lastTs).toBe(merged[1]!.ts);
    expect(manifest.chunks[1]?.firstTs).toBe(merged[2]!.ts);
    expect(manifest.chunks[1]?.lastTs).toBe(merged[2]!.ts);
  });
});
