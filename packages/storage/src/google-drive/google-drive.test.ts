import { describe, expect, it } from "vitest";
import { ObjectNotFoundError } from "../adapter.js";
import { runStorageConformance } from "../conformance.js";
import { GoogleDriveStorageAdapter } from "./adapter.js";
import { DriveAuthError, DriveClient } from "./client.js";
import { FakeDrive } from "./fake-drive.js";
import { APP_FOLDER_NAME, ensureAppFolder, ensureArchiveFolder, listArchiveFolders } from "./folders.js";

const KIB = 1024;

function setup(options: { uploadChunkBytes?: number; downloadChunkBytes?: number } = {}) {
  const drive = new FakeDrive();
  const root = drive.createFolder("archive-1");
  const client = new DriveClient({
    fetch: drive.fetch,
    getAccessToken: () => Promise.resolve(drive.validToken),
    sleep: () => Promise.resolve(),
  });
  const adapter = new GoogleDriveStorageAdapter({ client, rootFolderId: root, ...options });
  return { drive, root, client, adapter };
}

function pattern(length: number, seed = 7): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) out[i] = (i * 31 + seed) & 0xff;
  return out;
}

async function* parts(data: Uint8Array, sizes: readonly number[]): AsyncIterable<Uint8Array> {
  let offset = 0;
  let i = 0;
  while (offset < data.byteLength) {
    const size = sizes[i++ % sizes.length]!;
    yield data.subarray(offset, offset + size);
    offset += size;
  }
}

async function collect(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

runStorageConformance("GoogleDriveStorageAdapter (FakeDrive)", () => setup().adapter);

describe("GoogleDriveStorageAdapter — Drive-specific behaviour", () => {
  it("stores paths as real folders, so the Drive holds an ordinary archive directory", async () => {
    const { drive, root, adapter } = setup();
    await adapter.put("header.json", pattern(10));
    await adapter.put("chunks/0.jsonl.enc", pattern(10));
    await adapter.put("media/abc.enc", pattern(10));

    expect(drive.tree(root)).toEqual(["chunks/0.jsonl.enc", "header.json", "media/abc.enc"]);
    const names = [...drive.files.values()].map((f) => f.name);
    expect(names).not.toContain("chunks/0.jsonl.enc");
  });

  it("creates one folder when many writes into it race", async () => {
    const { drive, adapter } = setup();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => adapter.put(`media/${i}.enc`, pattern(5, i))),
    );
    const mediaFolders = [...drive.files.values()].filter((f) => f.name === "media");
    expect(mediaFolders).toHaveLength(1);
    expect(await adapter.list("media/")).toHaveLength(10);
  });

  it("streams a multi-chunk upload and a ranged download, byte for byte", async () => {
    const { drive, adapter } = setup({ uploadChunkBytes: 256 * KIB, downloadChunkBytes: 100 * KIB });
    const video = pattern(700 * KIB + 13);

    await adapter.putStream("media/video.enc", parts(video, [70 * KIB + 1, 3, 190 * KIB]));

    expect(await adapter.get("media/video.enc")).toEqual(video);
    expect(await collect(adapter.getStream("media/video.enc"))).toEqual(video);
    const chunkPuts = drive.log.filter((r) => r.method === "PUT");
    expect(chunkPuts).toHaveLength(3); // 256 KiB + 256 KiB + the rest
  });

  it("finishes a stream whose length is an exact multiple of the chunk size", async () => {
    const { adapter } = setup({ uploadChunkBytes: 256 * KIB });
    const blob = pattern(512 * KIB);
    await adapter.putStream("media/exact.enc", parts(blob, [256 * KIB]));
    expect(await adapter.get("media/exact.enc")).toEqual(blob);
  });

  it("resumes a streamed upload after the connection drops mid-chunk", async () => {
    const { drive, adapter } = setup({ uploadChunkBytes: 256 * KIB });
    const blob = pattern(600 * KIB);
    // The server receives the second chunk, the phone never hears back. Re-sending it blindly
    // would overlap bytes the session already holds; the adapter must ask and continue.
    let chunkPuts = 0;
    drive.failNext((url, init) => init.method === "PUT" && url.includes("/session/") && ++chunkPuts === 2, "drop");

    await adapter.putStream("media/flaky.enc", parts(blob, [64 * KIB]));

    expect(await adapter.get("media/flaky.enc")).toEqual(blob);
  });

  it("refreshes an expired token once and carries on", async () => {
    const drive = new FakeDrive();
    let cached = "token-1";
    let refreshes = 0;
    const adapter = new GoogleDriveStorageAdapter({
      client: new DriveClient({
        fetch: drive.fetch,
        getAccessToken: ({ forceRefresh }) => {
          if (forceRefresh) {
            refreshes += 1;
            cached = drive.validToken;
          }
          return Promise.resolve(cached);
        },
        sleep: () => Promise.resolve(),
      }),
      rootFolderId: drive.createFolder("archive"),
    });

    await adapter.put("header.json", pattern(4));
    drive.validToken = "token-2"; // the cached token expires
    await adapter.put("header.json", pattern(5));

    expect(refreshes).toBe(1);
    expect(await adapter.get("header.json")).toEqual(pattern(5));
  });

  it("reports revoked access as DriveAuthError, the cue to reconnect", async () => {
    const drive = new FakeDrive();
    const adapter = new GoogleDriveStorageAdapter({
      client: new DriveClient({
        fetch: drive.fetch,
        // The user revoked Boydem in their Google account: refreshing yields nothing usable.
        getAccessToken: () => Promise.resolve("revoked"),
        sleep: () => Promise.resolve(),
      }),
      rootFolderId: drive.createFolder("archive"),
    });
    await expect(adapter.put("header.json", pattern(4))).rejects.toBeInstanceOf(DriveAuthError);
  });

  it("backs off and retries when Drive rate-limits", async () => {
    const { drive, adapter } = setup();
    drive.failNext(() => true, { status: 403, body: { error: { errors: [{ reason: "userRateLimitExceeded" }] } } });
    drive.failNext(() => true, { status: 503 });
    await adapter.put("header.json", pattern(4));
    expect(await adapter.get("header.json")).toEqual(pattern(4));
  });

  it("tolerates duplicate names: reads the newest, lists once, removes all", async () => {
    const { drive, root, client, adapter } = setup();
    await adapter.put("manifest.json.enc", pattern(4, 1));
    // A second file with the same name — what a create whose response was lost, or another
    // device writing at the same moment, leaves behind. Made directly, bypassing any lookup.
    await drive.fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${drive.validToken}`, "Content-Type": "multipart/related; boundary=b" },
        body: `--b\r\nContent-Type: application/json\r\n\r\n{"name":"manifest.json.enc","parents":["${root}"]}\r\n--b\r\nContent-Type: application/octet-stream\r\n\r\nNEWER\r\n--b--`,
      },
    );
    // A fresh adapter, as on another device, with nothing cached.
    const second = new GoogleDriveStorageAdapter({ client, rootFolderId: root });

    expect(new TextDecoder().decode(await second.get("manifest.json.enc"))).toBe("NEWER");
    expect(await second.list("")).toEqual(["manifest.json.enc"]);
    await second.remove("manifest.json.enc");
    expect(await second.has("manifest.json.enc")).toBe(false);
  });

  it("moves removed files to the Drive trash rather than destroying them", async () => {
    const { drive, adapter } = setup();
    await adapter.put("media/abc.enc", pattern(4));
    await adapter.remove("media/abc.enc");
    const file = [...drive.files.values()].find((f) => f.name === "abc.enc");
    expect(file?.trashed).toBe(true);
  });

  it("recovers when a file it remembered was deleted in the Drive app", async () => {
    const { drive, adapter } = setup();
    await adapter.put("header.json", pattern(4));
    const id = [...drive.files.values()].find((f) => f.name === "header.json")!.id;
    drive.files.delete(id);

    await expect(adapter.get("header.json")).rejects.toBeInstanceOf(ObjectNotFoundError);
    await adapter.put("header.json", pattern(5));
    expect(await adapter.get("header.json")).toEqual(pattern(5));
  });

  it("escapes names in queries", async () => {
    const { adapter } = setup();
    await adapter.put("media/it's a \\ name.enc", pattern(4));
    expect(await adapter.has("media/it's a \\ name.enc")).toBe(true);
    expect(await adapter.get("media/it's a \\ name.enc")).toEqual(pattern(4));
  });

  it("answers 'is it there?' from one listing, without a request per file", async () => {
    const { drive, root, client, adapter } = setup();
    await adapter.put("media/a.jpg", pattern(4));
    const fresh = new GoogleDriveStorageAdapter({ client, rootFolderId: root });
    await fresh.list("");
    const before = drive.log.length;
    expect(await fresh.has("media/missing.jpg")).toBe(false);
    expect(await fresh.has("chunks/0.jsonl")).toBe(false);
    expect(await fresh.has("media/a.jpg")).toBe(true);
    expect(await fresh.sizeOf("media/a.jpg")).toBe(4);
    expect(drive.log.length).toBe(before);
  });

  it("stores photos as images, so Drive previews them", async () => {
    const { drive, adapter } = setup({ uploadChunkBytes: 256 * KIB });
    await adapter.put("media/a.jpg", pattern(4));
    await adapter.putStream("media/v.mp4", parts(pattern(300 * KIB), [100 * KIB]));
    await adapter.put("chunks/0.jsonl.enc", pattern(4));
    const types = Object.fromEntries([...drive.files.values()].map((f) => [f.name, f.mimeType]));
    expect(types["a.jpg"]).toBe("image/jpeg");
    expect(types["v.mp4"]).toBe("video/mp4");
    expect(types["0.jsonl.enc"]).toBe("application/octet-stream");
  });

  it("only ever talks to Google", async () => {
    const { drive, adapter } = setup({ uploadChunkBytes: 256 * KIB });
    await adapter.put("header.json", pattern(4));
    await adapter.putStream("media/v.enc", parts(pattern(300 * KIB), [100 * KIB]));
    await adapter.list("");
    const hosts = drive.log
      .filter((r) => !r.url.startsWith("https://fake.upload/")) // the fake's session URLs
      .map((r) => new URL(r.url).host);
    expect(new Set(hosts)).toEqual(new Set(["www.googleapis.com"]));
  });
});

describe("Drive folders", () => {
  it("finds the app folder by its tag, even after the user renames it", async () => {
    const { drive, client } = setup();
    const first = await ensureAppFolder(client);
    expect(drive.files.get(first)?.name).toBe(APP_FOLDER_NAME);

    drive.files.get(first)!.name = "WhatsApp backups";
    expect(await ensureAppFolder(client)).toBe(first);
  });

  it("names an archive's folder after the chat, and renames it when the name changes", async () => {
    const { drive, client } = setup();
    const app = await ensureAppFolder(client);
    const id = await ensureArchiveFolder(client, app, "arch-a", "Family ❤️");
    expect(drive.files.get(id)?.name).toBe("Family ❤️");

    expect(await ensureArchiveFolder(client, app, "arch-a", "Family (2024)")).toBe(id);
    expect(drive.files.get(id)?.name).toBe("Family (2024)");
    expect(await listArchiveFolders(client, app)).toEqual([{ archiveId: "arch-a", folderId: id }]);
  });

  it("makes one folder per archive, named by id, and lists them", async () => {
    const { drive, client } = setup();
    const app = await ensureAppFolder(client);
    const a = await ensureArchiveFolder(client, app, "arch-a");
    expect(await ensureArchiveFolder(client, app, "arch-a")).toBe(a);
    const b = await ensureArchiveFolder(client, app, "arch-b");

    expect(drive.files.get(a)?.name).toBe("arch-a");
    expect(await listArchiveFolders(client, app)).toEqual([
      { archiveId: "arch-a", folderId: a },
      { archiveId: "arch-b", folderId: b },
    ]);
  });
});
