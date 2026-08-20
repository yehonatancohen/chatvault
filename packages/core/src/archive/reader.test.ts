import { Buffer } from "node:buffer";
import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";

import { MemoryStorageAdapter } from "../../../storage/src/memory.js";
import { createWebCryptoProvider } from "../crypto/ports.js";
import { toHex } from "../crypto/sha256.js";
import { mergeBatches, mergeMerged } from "../merge.js";
import {
  aadFor,
  chunkPath,
  encodeSealed,
  FORMAT_VERSION,
  HEADER_PATH,
  MANIFEST_PATH,
  mediaPath,
  UnsupportedFormatError,
  type ArchiveHeader,
  type Manifest,
} from "./format.js";
import {
  ArchiveIntegrityError,
  ArchiveReader,
  MalformedHeaderError,
  readHeader,
  UnknownChunkError,
} from "./reader.js";
import { batch, content, message, testKey, testKeyWrapping, testSource } from "./testing.js";
import { ArchiveWriter } from "./writer.js";

const crypto = createWebCryptoProvider(webcrypto.subtle, (array) =>
  webcrypto.getRandomValues(array),
);

const ARCHIVE_ID = "arch-1";

// Base64 belongs to whoever wraps the key, not to core — a client has `btoa`/`Buffer` and core
// has neither. Node's is fine here for the same reason `node:crypto` is.
const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");
const fromBase64 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, "base64"));

const writerFor = (storage: MemoryStorageAdapter, messagesPerChunk?: number) =>
  new ArchiveWriter({
    crypto,
    storage,
    key: testKey(),
    archiveId: ARCHIVE_ID,
    keyWrapping: testKeyWrapping,
    ...(messagesPerChunk === undefined ? {} : { messagesPerChunk }),
  });

const open = (storage: MemoryStorageAdapter, key = testKey()) =>
  ArchiveReader.open({ crypto, storage, key, archiveId: ARCHIVE_ID });

/** Re-seals a doctored manifest under the correct key and AAD, as only we can. */
async function replaceManifest(
  storage: MemoryStorageAdapter,
  manifest: Manifest,
): Promise<void> {
  const plaintext = new TextEncoder().encode(JSON.stringify(manifest));
  const sealed = await crypto.seal(testKey(), plaintext, aadFor(ARCHIVE_ID, MANIFEST_PATH));
  await storage.put(MANIFEST_PATH, encodeSealed(sealed));
}

describe("ArchiveReader", () => {
  it("round-trips messages, preserving content and order", async () => {
    const storage = new MemoryStorageAdapter();
    const messages = [
      message(3, "Dana", "third"),
      message(0, "Dana", "first"),
      message(1, "Ravid", "second"),
    ];
    await writerFor(storage).write(content({ batches: [batch("s1", messages)] }));

    const reader = await open(storage);

    // Compared against the merge output, not the input: merge is what defines the archive's
    // canonical order and it adds `sourceIds` the caller never wrote.
    expect(await reader.readAll()).toEqual(mergeBatches([batch("s1", messages)]));
  });

  it("reassembles messages that span several chunks", async () => {
    const storage = new MemoryStorageAdapter();
    const messages = Array.from({ length: 7 }, (_, i) => message(i, "Dana", `m${i}`));
    await writerFor(storage, 3).write(content({ batches: [batch("s1", messages)] }));

    const reader = await open(storage);

    expect(reader.manifest.chunks).toHaveLength(3);
    expect(await reader.readChunk(1)).toHaveLength(3);
    expect((await reader.readAll()).map((m) => m.body)).toEqual([
      "m0",
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
    ]);
  });

  it("resolves a message id to the one chunk holding it", async () => {
    const storage = new MemoryStorageAdapter();
    const messages = Array.from({ length: 7 }, (_, i) => message(i, "Dana", `m${i}`));
    await writerFor(storage, 3).write(content({ batches: [batch("s1", messages)] }));
    const merged = mergeBatches([batch("s1", messages)]);

    const reader = await open(storage);

    expect(await reader.readIndex()).toMatchObject({ [merged[5]!.id]: 1 });
    expect(await reader.findMessage(merged[5]!.id)).toEqual(merged[5]);
    expect(await reader.findMessage("not-a-message")).toBeUndefined();
  });

  it("refuses a chunk index the manifest does not describe", async () => {
    const storage = new MemoryStorageAdapter();
    await writerFor(storage).write(content());
    const reader = await open(storage);

    await expect(reader.readChunk(4)).rejects.toThrow(UnknownChunkError);
  });

  it("preserves an attachment's filename and hash through the round trip", async () => {
    const storage = new MemoryStorageAdapter();
    const base = message(0, "Dana", "sunset.jpg");
    const withAttachment = {
      ...base,
      kind: "attachment" as const,
      attachment: { filename: "IMG-0001.jpg", sha256: "abc123" },
    };
    await writerFor(storage).write(content({ batches: [batch("s1", [withAttachment])] }));

    const [read] = await (await open(storage)).readAll();

    expect(read?.attachment).toEqual({ filename: "IMG-0001.jpg", sha256: "abc123" });
  });

  describe("media", () => {
    const photo = Uint8Array.from({ length: 128 }, (_, i) => (i * 7) % 256);

    it("reads a blob back by its content address", async () => {
      const storage = new MemoryStorageAdapter();
      const manifest = await writerFor(storage).write(
        content({ media: [{ filename: "a.jpg", bytes: photo }] }),
      );

      const reader = await open(storage);
      const hash = manifest.media[0]!.sha256;

      expect(await reader.readMedia(hash)).toEqual(photo);

      const streamed: Uint8Array[] = [];
      for await (const part of reader.streamMedia(hash)) streamed.push(part);
      expect(streamed).toEqual([photo]);
    });

    it("rejects a blob whose plaintext does not hash to its address", async () => {
      const storage = new MemoryStorageAdapter();
      await writerFor(storage).write(content({ media: [{ filename: "a.jpg", bytes: photo }] }));
      const reader = await open(storage);

      // Note what it takes to reach this check: simply moving a blob to another address fails
      // the AAD binding first. So the forgery has to be sealed *correctly* for the address it
      // sits at, with the wrong bytes inside — a mislabelled write rather than a swap.
      const address = toHex(await crypto.sha256(Uint8Array.of(1, 2, 3)));
      const path = mediaPath(address);
      const sealed = await crypto.seal(testKey(), photo, aadFor(ARCHIVE_ID, path));
      await storage.put(path, encodeSealed(sealed));

      await expect(reader.readMedia(address)).rejects.toThrow(ArchiveIntegrityError);
    });
  });

  describe("integrity", () => {
    it("fails to open under the wrong key", async () => {
      const storage = new MemoryStorageAdapter();
      await writerFor(storage).write(content());

      await expect(open(storage, testKey(99))).rejects.toThrow();
    });

    it("catches a tampered chunk on its hash, before any key is used", async () => {
      const storage = new MemoryStorageAdapter();
      await writerFor(storage).write(content());
      const reader = await open(storage);

      const stored = await storage.get(chunkPath(0));
      stored[stored.length - 1] = (stored[stored.length - 1] ?? 0) ^ 0xff;
      await storage.put(chunkPath(0), stored);

      await expect(reader.readChunk(0)).rejects.toThrow(ArchiveIntegrityError);
    });

    it("rejects a chunk swapped for another chunk of the same archive", async () => {
      const storage = new MemoryStorageAdapter();
      const messages = [message(0, "Dana", "a"), message(1, "Dana", "b")];
      await writerFor(storage, 1).write(content({ batches: [batch("s1", messages)] }));
      const manifest = (await open(storage)).manifest;

      // The attacker moves chunk 1 over chunk 0 *and* updates the manifest hash to match, so
      // the integrity check passes. Only the AAD binding stands between them and a reordered
      // chat — this is the assertion that proves it holds.
      const swapped = await storage.get(chunkPath(1));
      await storage.put(chunkPath(0), swapped);
      await replaceManifest(storage, {
        ...manifest,
        chunks: manifest.chunks.map((ref) =>
          ref.index === 0 ? { ...ref, sha256: manifest.chunks[1]!.sha256 } : ref,
        ),
      });

      const reader = await open(storage);
      await expect(reader.readChunk(0)).rejects.not.toThrow(ArchiveIntegrityError);
      await expect(reader.readChunk(0)).rejects.toThrow();
    });

    it("refuses an archive written by a newer format version", async () => {
      const storage = new MemoryStorageAdapter();
      const manifest = await writerFor(storage).write(content());
      await replaceManifest(storage, { ...manifest, formatVersion: FORMAT_VERSION + 1 });

      await expect(open(storage)).rejects.toThrow(UnsupportedFormatError);
    });

    it("refuses a newer version from the header alone, with no usable key", async () => {
      const storage = new MemoryStorageAdapter();
      await writerFor(storage).write(content());
      const header = JSON.parse(
        new TextDecoder().decode(await storage.get(HEADER_PATH)),
      ) as ArchiveHeader;
      await storage.put(
        HEADER_PATH,
        new TextEncoder().encode(JSON.stringify({ ...header, formatVersion: 999 })),
      );

      // The whole payoff of moving the version out of the sealed manifest: a user is told
      // their app is too old instead of being told, misleadingly, that decryption failed.
      await expect(readHeader(storage, ARCHIVE_ID)).rejects.toThrow(UnsupportedFormatError);
      await expect(open(storage, testKey(123))).rejects.toThrow(UnsupportedFormatError);
    });

    it("rejects a header belonging to a different archive", async () => {
      const storage = new MemoryStorageAdapter();
      await writerFor(storage).write(content());

      await expect(readHeader(storage, "arch-2")).rejects.toThrow(MalformedHeaderError);
    });
  });

  describe("the passphrase flow", () => {
    const PASSPHRASE = "correct horse battery staple";
    // Well below production cost, purely so the suite stays fast — the point of the test is
    // that `deriveKey` is genuinely on the path, not how expensive it is.
    const ITERATIONS = 50_000;

    /** Writes an archive whose key exists only in wrapped form on disk. */
    async function writeWrapped(storage: MemoryStorageAdapter, passphrase = PASSPHRASE) {
      const archiveKey = crypto.randomBytes(32);
      const salt = crypto.randomBytes(16);
      const wrappingKey = await crypto.deriveKey(passphrase, {
        salt,
        iterations: ITERATIONS,
        algorithm: "PBKDF2-SHA256",
      });
      const wrapped = await crypto.seal(wrappingKey, archiveKey);

      const writer = new ArchiveWriter({
        crypto,
        storage,
        key: archiveKey,
        archiveId: ARCHIVE_ID,
        keyWrapping: {
          algorithm: "PBKDF2-SHA256",
          saltBase64: toBase64(salt),
          iterations: ITERATIONS,
          wrappedKeyBase64: toBase64(wrapped.ciphertext),
          ivBase64: toBase64(wrapped.iv),
        },
      });
      await writer.write(content({ batches: [batch("s1", [message(0, "Dana", "hello")])] }));
      return archiveKey;
    }

    /** The client side: passphrase in, archive key out, nothing else available. */
    async function unwrapWithPassphrase(
      storage: MemoryStorageAdapter,
      passphrase: string,
    ): Promise<Uint8Array> {
      const { keyWrapping } = await readHeader(storage, ARCHIVE_ID);
      // The algorithm comes from the header, not from a constant here. A provider that does
      // not implement it must throw `UnsupportedKdfError` rather than silently deriving a
      // PBKDF2 key and reporting the user's correct passphrase as wrong.
      const wrappingKey = await crypto.deriveKey(passphrase, {
        salt: fromBase64(keyWrapping.saltBase64),
        iterations: keyWrapping.iterations,
        algorithm: keyWrapping.algorithm,
      });
      return crypto.open(wrappingKey, {
        iv: fromBase64(keyWrapping.ivBase64),
        ciphertext: fromBase64(keyWrapping.wrappedKeyBase64),
      });
    }

    it("goes passphrase -> header -> key -> manifest -> messages", async () => {
      const storage = new MemoryStorageAdapter();
      const archiveKey = await writeWrapped(storage);

      // Everything past this line uses only the passphrase and what is on disk. The archive
      // key is never handed to the reader by the test; it is derived and unwrapped.
      const unwrapped = await unwrapWithPassphrase(storage, PASSPHRASE);
      expect(unwrapped).toEqual(archiveKey);

      const reader = await ArchiveReader.open({
        crypto,
        storage,
        key: unwrapped,
        archiveId: ARCHIVE_ID,
      });
      expect((await reader.readAll()).map((m) => m.body)).toEqual(["hello"]);
      expect(reader.header.keyWrapping.iterations).toBe(ITERATIONS);
    });

    it("yields nothing for the wrong passphrase", async () => {
      const storage = new MemoryStorageAdapter();
      await writeWrapped(storage);

      await expect(unwrapWithPassphrase(storage, "correct horse battery stapl")).rejects.toThrow();
    });

    it("stays shut when another archive's header is swapped in", async () => {
      const mine = new MemoryStorageAdapter();
      const theirs = new MemoryStorageAdapter();
      await writeWrapped(mine);
      await writeWrapped(theirs, "a different passphrase entirely");

      // The header is cleartext, so `archiveId` stops an accident, not an attacker — they
      // would edit it to match. The substitution still dead-ends: the passphrase unwraps the
      // *other* archive's key, and this archive's manifest refuses it.
      const foreign = JSON.parse(
        new TextDecoder().decode(await theirs.get(HEADER_PATH)),
      ) as ArchiveHeader;
      await mine.put(
        HEADER_PATH,
        new TextEncoder().encode(JSON.stringify({ ...foreign, archiveId: ARCHIVE_ID })),
      );

      await expect(unwrapWithPassphrase(mine, PASSPHRASE)).rejects.toThrow();

      const foreignKey = await unwrapWithPassphrase(theirs, "a different passphrase entirely");
      await expect(
        ArchiveReader.open({ crypto, storage: mine, key: foreignKey, archiveId: ARCHIVE_ID }),
      ).rejects.toThrow();
    });

    it("stays shut when the header's KDF cost is tampered with", async () => {
      const storage = new MemoryStorageAdapter();
      await writeWrapped(storage);

      const header = JSON.parse(
        new TextDecoder().decode(await storage.get(HEADER_PATH)),
      ) as ArchiveHeader;
      await storage.put(
        HEADER_PATH,
        new TextEncoder().encode(
          JSON.stringify({
            ...header,
            keyWrapping: { ...header.keyWrapping, iterations: 1 },
          }),
        ),
      );

      // The header is cleartext and unauthenticated, so anyone can edit it — and it buys them
      // nothing. A different iteration count derives a different key and the unwrap fails.
      await expect(unwrapWithPassphrase(storage, PASSPHRASE)).rejects.toThrow();
    });
  });

  describe("after an append", () => {
    it("holds every message exactly once", async () => {
      const storage = new MemoryStorageAdapter();
      const writer = writerFor(storage, 2);
      const dana = [message(0, "Dana", "a"), message(1, "Dana", "b"), message(2, "Dana", "c")];
      const ravid = [message(2, "Dana", "c"), message(4, "Ravid", "d"), message(5, "Ravid", "e")];

      await writer.write(content({ batches: [batch("s1", dana)] }));
      const manifest = await writer.append(
        content({ sources: [testSource("s2")], batches: [batch("s2", ravid)] }),
      );

      const all = await (await open(storage)).readAll();
      const expected = mergeMerged(
        mergeBatches([batch("s1", dana)]),
        mergeBatches([batch("s2", ravid)]),
      );

      expect(all).toEqual(expected);
      expect(all).toHaveLength(5);
      expect(new Set(all.map((m) => m.id)).size).toBe(5);
      expect(manifest.messageCount).toBe(5);
      // The message both members exported carries both source ids — the append kept the merge,
      // it did not just concatenate.
      expect(all.find((m) => m.body === "c")?.sourceIds).toEqual(["s1", "s2"]);
    });

    it("stays correct when the appended messages are older than everything stored", async () => {
      const storage = new MemoryStorageAdapter();
      const writer = writerFor(storage, 2);
      const recent = [message(10, "Dana", "a"), message(11, "Dana", "b"), message(12, "Dana", "c")];
      const older = [message(0, "Ravid", "x"), message(1, "Ravid", "y")];

      await writer.write(content({ batches: [batch("s1", recent)] }));
      // The interesting direction: a member's export reaching further back shifts every
      // message right, so no chunk can be reused and the index must be rebuilt wholesale.
      await writer.append(content({ sources: [testSource("s2")], batches: [batch("s2", older)] }));

      const reader = await open(storage);
      const all = await reader.readAll();

      expect(all).toEqual(
        mergeMerged(mergeBatches([batch("s1", recent)]), mergeBatches([batch("s2", older)])),
      );
      expect(all.map((m) => m.body)).toEqual(["x", "y", "a", "b", "c"]);
      for (const stored of all) {
        expect(await reader.findMessage(stored.id)).toEqual(stored);
      }
    });

    it("leaves the index consistent with the new chunk layout", async () => {
      const storage = new MemoryStorageAdapter();
      const writer = writerFor(storage, 2);
      await writer.write(
        content({ batches: [batch("s1", [message(0, "Dana", "a"), message(1, "Dana", "b")])] }),
      );
      await writer.append(
        content({
          sources: [testSource("s2")],
          batches: [batch("s2", [message(2, "Ravid", "c"), message(3, "Ravid", "d")])],
        }),
      );

      const reader = await open(storage);
      const index = await reader.readIndex();

      for (const [id, chunkIndex] of Object.entries(index)) {
        expect((await reader.readChunk(chunkIndex)).map((m) => m.id)).toContain(id);
      }
      expect(Object.keys(index)).toHaveLength(4);
    });
  });
});
