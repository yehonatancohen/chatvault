import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ArchiveReader,
  ArchiveWriter,
  computeMessageId,
  createWebCryptoProvider,
  HEADER_PATH,
  MANIFEST_PATH,
  type ArchiveContent,
  type KeyWrapping,
} from "@chatvault/core";
import type { StorageAdapter } from "./adapter.js";
import { MemoryStorageAdapter } from "./memory.js";
import { GoogleDriveStorageAdapter } from "./google-drive/adapter.js";
import { DriveClient } from "./google-drive/client.js";
import { FakeDrive } from "./google-drive/fake-drive.js";
import { pullArchive, pushArchive, type SyncLedger } from "./sync.js";

/**
 * Sync is checked against *real archives* — written by core's `ArchiveWriter` with a real
 * WebCrypto, read back by `ArchiveReader` — pushed through the Drive adapter over `FakeDrive`.
 * A sync that copies bytes faithfully but in the wrong order, or misses a rewritten chunk,
 * produces an archive that fails exactly here: at open, or with the wrong message count.
 */

const crypto = createWebCryptoProvider(webcrypto.subtle, (array) => webcrypto.getRandomValues(array));
const KEY = Uint8Array.from({ length: 32 }, (_, i) => (i * 31 + 7) % 251);
const ARCHIVE_ID = "arch-sync";
const WRAPPING: KeyWrapping = {
  algorithm: "PBKDF2-SHA256",
  saltBase64: "c2FsdHktc2FsdA==",
  iterations: 210_000,
  wrappedKeyBase64: "d3JhcHBlZC1rZXktYnl0ZXM=",
  ivBase64: "aXYtdHdlbHZlLQ==",
};

const sha256Hex = async (bytes: Uint8Array): Promise<string> =>
  Buffer.from(await crypto.sha256(bytes)).toString("hex");

function text(minute: number, sender: string, body: string) {
  const ts = Date.UTC(2024, 2, 15, 9, 0, 0) + minute * 60_000;
  const wallClock = new Date(ts).toISOString().slice(0, 19);
  return { id: computeMessageId({ wallClock, sender, body, kind: "text" }), ts, wallClock, sender, body, kind: "text" as const };
}

function content(sourceId: string, messages: ReturnType<typeof text>[], media: Uint8Array[] = []): ArchiveContent {
  return {
    chatTitle: "Trip planning",
    participants: [{ id: "p1", displayName: "Dana", aliases: [] }],
    sources: [
      {
        id: sourceId,
        contributor: sourceId,
        tzOffsetMinutes: 0,
        importedAt: 1_700_000_000_000,
        dialect: { dateOrder: "DMY", platform: "android", hasSeconds: false, clock: "24h" },
      },
    ],
    batches: [{ sourceId, messages }],
    media: media.map((bytes, i) => ({ filename: `IMG-${sourceId}-${i}.jpg`, read: async () => bytes })),
  };
}

const writer = (storage: StorageAdapter) =>
  new ArchiveWriter({ crypto, storage, key: KEY, archiveId: ARCHIVE_ID, keyWrapping: WRAPPING, now: () => 1_700_000_000_000 });

const open = (storage: StorageAdapter) => ArchiveReader.open({ crypto, storage, key: KEY, archiveId: ARCHIVE_ID });

const photo = (seed: number, length = 300 * 1024) =>
  Uint8Array.from({ length }, (_, i) => (i * 13 + seed) & 0xff);

function drive() {
  const fake = new FakeDrive();
  const client = new DriveClient({ fetch: fake.fetch, getAccessToken: () => Promise.resolve(fake.validToken), sleep: () => Promise.resolve() });
  const folder = fake.createFolder(ARCHIVE_ID);
  const adapter = () => new GoogleDriveStorageAdapter({ client, rootFolderId: folder, uploadChunkBytes: 256 * 1024 });
  return { fake, folder, adapter };
}

/** Records the order objects were written in. */
class Recording extends MemoryStorageAdapter {
  readonly writes: string[] = [];
  override put(path: string, data: Uint8Array): Promise<void> {
    this.writes.push(path);
    return super.put(path, data);
  }
}

describe("pushArchive", () => {
  it("backs a real archive up to Drive, and the copy opens with the same key", async () => {
    const local = new MemoryStorageAdapter();
    await writer(local).write(content("s1", [text(0, "Dana", "hi"), text(1, "Ravid", "hello")], [photo(1), photo(2)]));
    const { adapter } = drive();

    const result = await pushArchive(local, adapter(), {}, { sha256Hex });

    expect(result.kind).toBe("pushed");
    const copy = await open(adapter());
    expect(copy.manifest.messageCount).toBe(2);
    expect((await copy.readAll()).map((m) => m.body)).toEqual(["hi", "hello"]);
    expect(await copy.readMedia(copy.manifest.media[0]!.sha256)).toHaveLength(300 * 1024);
  });

  it("sends nothing the second time", async () => {
    const local = new MemoryStorageAdapter();
    await writer(local).write(content("s1", [text(0, "Dana", "hi")], [photo(1)]));
    const { fake, adapter } = drive();
    const first = await pushArchive(local, adapter(), {}, { sha256Hex });
    if (first.kind !== "pushed") throw new Error("expected a push");

    const uploadsBefore = fake.log.filter((r) => r.url.includes("/upload/")).length;
    const second = await pushArchive(local, adapter(), first.ledger, { sha256Hex });

    expect(second).toMatchObject({ kind: "pushed", copied: 0 });
    expect(fake.log.filter((r) => r.url.includes("/upload/")).length).toBe(uploadsBefore);
  });

  it("re-sends a rewritten chunk after an append, but never media it already sent", async () => {
    const local = new MemoryStorageAdapter();
    await writer(local).write(content("s1", [text(0, "Dana", "hi")], [photo(1)]));
    const { adapter } = drive();
    const first = await pushArchive(local, adapter(), {}, { sha256Hex });
    if (first.kind !== "pushed") throw new Error("expected a push");

    // A second member's export: same chunk index, new messages — the writer re-seals chunk 0.
    await writer(local).append(content("s2", [text(0, "Dana", "hi"), text(5, "Noa", "late reply")], [photo(1)]));
    const second = await pushArchive(local, adapter(), first.ledger, { sha256Hex });

    expect(second.kind).toBe("pushed");
    if (second.kind !== "pushed") return;
    expect(second.copied).toBeGreaterThan(0);
    const copy = await open(adapter());
    expect(copy.manifest.messageCount).toBe(2);
    expect((await copy.readAll()).map((m) => m.body)).toEqual(["hi", "late reply"]);
  });

  it("writes the manifest last, so a half-done backup never names missing objects", async () => {
    const local = new MemoryStorageAdapter();
    await writer(local).write(content("s1", [text(0, "Dana", "hi")], [photo(1), photo(2)]));
    const remote = new Recording();

    await pushArchive(local, remote, {}, { sha256Hex });

    expect(remote.writes.at(-1)).toBe(MANIFEST_PATH);
    expect(remote.writes.slice(0, 2).every((p) => p.startsWith("media/"))).toBe(true);
  });

  it("refuses to overwrite a Drive copy another device has changed", async () => {
    const phoneA = new MemoryStorageAdapter();
    await writer(phoneA).write(content("s1", [text(0, "Dana", "hi")]));
    const { adapter } = drive();
    const pushedA = await pushArchive(phoneA, adapter(), {}, { sha256Hex });
    if (pushedA.kind !== "pushed") throw new Error("expected a push");

    // Phone B restores, appends, and backs up.
    const phoneB = new MemoryStorageAdapter();
    const ledgerB = await pullArchive(adapter(), phoneB, { sha256Hex });
    await writer(phoneB).append(content("s2", [text(9, "Noa", "from phone B")]));
    await pushArchive(phoneB, adapter(), ledgerB, { sha256Hex });

    // Phone A, still on its own version, appends something else and tries to push.
    await writer(phoneA).append(content("s3", [text(20, "Dana", "from phone A")]));
    const result = await pushArchive(phoneA, adapter(), pushedA.ledger, { sha256Hex });

    expect(result.kind).toBe("diverged");
    const copy = await open(adapter());
    expect((await copy.readAll()).map((m) => m.body)).toContain("from phone B");
  });

  it("adopts a Drive copy identical to the local one, even with no ledger", async () => {
    const local = new MemoryStorageAdapter();
    await writer(local).write(content("s1", [text(0, "Dana", "hi")]));
    const { adapter } = drive();
    await pushArchive(local, adapter(), {}, { sha256Hex });

    // The ledger was lost (reinstall); the contents are the same.
    expect((await pushArchive(local, adapter(), {}, { sha256Hex })).kind).toBe("pushed");
  });

  it("resumes an interrupted backup without re-sending what already landed", async () => {
    const local = new MemoryStorageAdapter();
    await writer(local).write(content("s1", [text(0, "Dana", "hi")], [photo(1), photo(2), photo(3)]));
    const { fake, adapter } = drive();

    let saved: SyncLedger = {};
    const onLedger = async (ledger: SyncLedger) => {
      saved = ledger;
    };
    // The connection dies for good partway through (after two media uploads).
    let uploads = 0;
    fake.failNext(
      (url) => url.includes("/upload/") && ++uploads === 3,
      { status: 400, body: { error: { message: "simulated" } } },
    );
    await expect(pushArchive(local, adapter(), {}, { sha256Hex, onLedger })).rejects.toThrow();

    const result = await pushArchive(local, adapter(), saved, { sha256Hex, onLedger });
    expect(result.kind).toBe("pushed");
    if (result.kind !== "pushed") return;
    expect(result.unchanged).toBeGreaterThanOrEqual(2);
    expect((await open(adapter())).manifest.messageCount).toBe(1);
  });
});

describe("pullArchive", () => {
  it("restores an archive from Drive onto an empty device, header last", async () => {
    const original = new MemoryStorageAdapter();
    await writer(original).write(content("s1", [text(0, "Dana", "hi"), text(1, "Ravid", "yo")], [photo(4)]));
    const { adapter } = drive();
    await pushArchive(original, adapter(), {}, { sha256Hex });

    const newPhone = new Recording();
    const ledger = await pullArchive(adapter(), newPhone, { sha256Hex });

    expect(newPhone.writes.at(-1)).toBe(HEADER_PATH);
    const restored = await open(newPhone);
    expect((await restored.readAll()).map((m) => m.body)).toEqual(["hi", "yo"]);
    // The ledger means the next push from this phone sends nothing.
    expect(await pushArchive(newPhone, adapter(), ledger, { sha256Hex })).toMatchObject({ copied: 0 });
  });

  it("never overwrites an archive already on the device", async () => {
    const local = new MemoryStorageAdapter();
    await writer(local).write(content("s1", [text(0, "Dana", "hi")]));
    const { adapter } = drive();
    await pushArchive(local, adapter(), {}, { sha256Hex });
    await expect(pullArchive(adapter(), local, { sha256Hex })).rejects.toThrow(/already on this device/);
  });

  it("refuses a Drive copy that was never fully backed up", async () => {
    const { adapter } = drive();
    await adapter().put("media/x.enc", photo(1, 10));
    await expect(pullArchive(adapter(), new MemoryStorageAdapter(), { sha256Hex })).rejects.toThrow(/incomplete/);
  });
});
