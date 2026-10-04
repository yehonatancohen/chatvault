import { webcrypto, createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ArchiveReader, HEADER_PATH, InMemoryMediaSource, KEY_LENGTH, createWebCryptoProvider, type KeyWrapping } from "@chatvault/core";
import { MemoryStorageAdapter, pushArchive } from "@chatvault/storage";
import { runImport } from "../import/run-import";
import { offloadArchiveContent } from "./offload";
import { stageRemoteArchive } from "./stage";
import { withArchiveOperation } from "../archive/operation";

const crypto = createWebCryptoProvider(webcrypto.subtle as never, bytes => webcrypto.getRandomValues(bytes));
const hash = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const transcript = "[14/03/2025, 20:11:02] Alice: hello\n[14/03/2025, 20:12:00] Bob: world";
const wrapping: KeyWrapping = { algorithm: "PBKDF2-SHA256", saltBase64: "AAAAAAAAAAAAAAAAAAAAAA==", iterations: 1000, wrappedKeyBase64: "AAAA", ivBase64: "AAAAAAAAAAAAAAAA" };

describe("Drive archive lifecycle", () => {
  for (const protectedChat of [false, true]) it(`backs up, frees content, reads and appends a ${protectedChat ? "protected" : "plain"} chat`, async () => {
    const local = new MemoryStorageAdapter();
    const remote = new MemoryStorageAdapter();
    const key = protectedChat ? new Uint8Array(KEY_LENGTH).fill(7) : undefined;
    const request = { transcript, media: new InMemoryMediaSource(), storage: local, crypto, archiveId: "chat", chatTitle: "Fixture", sourceId: "first", contributor: null, tzOffsetMinutes: 0, ...(key ? { key, keyWrapping: wrapping } : {}) };
    await runImport(request);
    await local.put("media/fixture", new Uint8Array([1, 2, 3]));
    await local.put("thumbs/fixture", new Uint8Array([4, 5]));
    const result = await pushArchive(local, remote, {}, { sha256Hex: hash });
    expect(result.kind).toBe("pushed");
    const mark = vi.fn(async () => {});
    await offloadArchiveContent(local, remote, hash, mark, () => {});
    expect(mark).toHaveBeenCalledOnce();
    expect(await local.list("")).toEqual([HEADER_PATH]);
    const reader = await ArchiveReader.open({ storage: remote, crypto, archiveId: "chat", key });
    expect((await reader.readAll()).map(m => m.body)).toEqual(["hello", "world"]);
    const ledger = await stageRemoteArchive(local, remote, new MemoryStorageAdapter(), hash, () => {});
    expect(await local.has("media/fixture")).toBe(false);
    const appended = await runImport({ ...request, sourceId: "second", transcript: transcript + "\n[14/03/2025, 20:13:00] Alice: added" });
    expect(appended.messageCount).toBe(3);
    expect((await pushArchive(local, remote, ledger, { sha256Hex: hash })).kind).toBe("pushed");
    await offloadArchiveContent(local, remote, hash, async () => {}, () => {});
    expect(await local.list("")).toEqual([HEADER_PATH]);
    expect((await (await ArchiveReader.open({ storage: remote, crypto, archiveId: "chat", key })).readAll()).length).toBe(3);
    expect(await remote.get("media/fixture")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("keeps every local file if a remote metadata file is missing or corrupt", async () => {
    for (const corrupt of [false, true]) {
      const local = new MemoryStorageAdapter(), remote = new MemoryStorageAdapter();
      await local.put(HEADER_PATH, new Uint8Array([1]));
      await remote.put(HEADER_PATH, new Uint8Array([1]));
      await local.put("chunks/a", new Uint8Array([2]));
      await local.put("manifest.json", new Uint8Array([3]));
      await remote.put("chunks/a", new Uint8Array([2]));
      if (corrupt) await remote.put("manifest.json", new Uint8Array([4]));
      const mark = vi.fn(async () => {});
      await expect(offloadArchiveContent(local, remote, hash, mark, () => {})).rejects.toThrow();
      expect(mark).not.toHaveBeenCalled();
      expect((await local.list("")).length).toBe(3);
    }
  });

  it("keeps all local content if the remote header is corrupt", async () => {
    const local = new MemoryStorageAdapter(), remote = new MemoryStorageAdapter();
    await local.put(HEADER_PATH, new Uint8Array([1]));
    await remote.put(HEADER_PATH, new Uint8Array([2]));
    await local.put("chunks/a", new Uint8Array([3]));
    await remote.put("chunks/a", new Uint8Array([3]));
    const mark = vi.fn(async () => {});
    await expect(offloadArchiveContent(local, remote, hash, mark, () => {})).rejects.toThrow("content differs");
    expect(mark).not.toHaveBeenCalled();
    expect(await local.has("chunks/a")).toBe(true);
  });

  it("keeps local media when its uploaded size differs", async () => {
    const local = new MemoryStorageAdapter(), remote = new MemoryStorageAdapter();
    await local.put("media/a", new Uint8Array([1, 2]));
    await remote.put("media/a", new Uint8Array([1]));
    await expect(offloadArchiveContent(local, remote, hash, async () => {}, () => {})).rejects.toThrow("size differs");
    expect(await local.has("media/a")).toBe(true);
  });

  it("does not delete a local file when its cloud marker cannot be persisted", async () => {
    const local = new MemoryStorageAdapter(), remote = new MemoryStorageAdapter();
    await local.put("chunks/a", new Uint8Array([2]));
    await remote.put("chunks/a", new Uint8Array([2]));
    await expect(offloadArchiveContent(local, remote, hash, async () => { throw new Error("disk full"); }, () => {})).rejects.toThrow("disk full");
    expect(await local.has("chunks/a")).toBe(true);
  });

  it("stops cleanup if the connected account changes", async () => {
    const local = new MemoryStorageAdapter(), remote = new MemoryStorageAdapter();
    await local.put("chunks/a", new Uint8Array([2]));
    await remote.put("chunks/a", new Uint8Array([2]));
    let changed = false;
    await expect(offloadArchiveContent(local, remote, hash, async () => { changed = true; }, () => { if (changed) throw new Error("account changed"); })).rejects.toThrow("account changed");
    expect(await local.has("chunks/a")).toBe(true);
  });

  it("leaves a local stub intact when staging a remote archive fails", async () => {
    const local = new MemoryStorageAdapter(), remote = new MemoryStorageAdapter();
    await local.put(HEADER_PATH, new Uint8Array([1]));
    await expect(stageRemoteArchive(local, remote, new MemoryStorageAdapter(), hash, () => {})).rejects.toThrow("incomplete");
    expect(await local.get(HEADER_PATH)).toEqual(new Uint8Array([1]));
  });

  it("serializes imports with backup cleanup and recovers after a failed operation", async () => {
    const events: string[] = [];
    let resume!: () => void;
    const gate = new Promise<void>(resolve => { resume = resolve; });
    const first = withArchiveOperation("chat", async () => { events.push("upload"); await gate; events.push("cleanup"); throw new Error("interrupted"); });
    const second = withArchiveOperation("chat", async () => { events.push("append"); });
    await Promise.resolve();
    resume();
    await expect(first).rejects.toThrow("interrupted");
    await second;
    expect(events).toEqual(["upload", "cleanup", "append"]);
  });
});
