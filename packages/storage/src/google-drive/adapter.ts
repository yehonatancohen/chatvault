import {
  ObjectNotFoundError,
  type LocalFile,
  type PutFileOptions,
  type StorageAdapter,
  type StorageCapabilities,
} from "../adapter.js";
import {
  asciiBytes,
  asciiJson,
  DRIVE_API,
  DRIVE_UPLOAD_API,
  DriveError,
  FOLDER_MIME,
  quote,
  type DriveClient,
  type DriveFile,
} from "./client.js";

/**
 * One archive, stored in a folder in the user's own Google Drive.
 *
 * **Paths become real folders.** `chunks/0.jsonl.enc` is a file named `0.jsonl.enc` inside a
 * `chunks` folder inside the archive's folder — not a file with a slash in its name. So a user
 * who opens their Drive sees an ordinary `.cvault` directory they can download and open with
 * any copy of the app, and "you're never locked in" stays literally true.
 *
 * **Drive is not a filesystem, and three differences shape this file:**
 *
 * - *Names are not unique.* Two files called `manifest.json.enc` can sit in one folder — after a
 *   retried create whose first response was lost, or two devices writing at once. Reads always
 *   take the most recently modified; `list` reports each path once; `remove` trashes them all.
 * - *Everything is addressed by id.* Resolving a path costs a query per folder level, so folder
 *   ids and file ids are cached for the life of the adapter. A cached file id that has gone
 *   stale (deleted in the Drive UI) is dropped and looked up again.
 * - *Removing trashes.* `remove` moves files to the user's Drive trash rather than deleting
 *   them, so a mistaken cleanup is recoverable for 30 days (`packages/storage/CLAUDE.md`:
 *   never destroy a user's data without them asking).
 *
 * Large media goes through Drive's resumable upload in fixed-size chunks and comes back in
 * ranged downloads, so neither direction ever holds a whole video in memory.
 */

export interface GoogleDriveAdapterOptions {
  readonly client: DriveClient;
  /** The archive's folder. Create it with `ensureArchiveFolder` (`folders.ts`). */
  readonly rootFolderId: string;
  /** Resumable upload chunk. Must be a multiple of 256 KiB (Drive's rule). Default 8 MiB. */
  readonly uploadChunkBytes?: number;
  /** Ranged download chunk for `getStream`. Default 4 MiB. */
  readonly downloadChunkBytes?: number;
}

const UPLOAD_GRANULE = 256 * 1024;
const OCTET = "application/octet-stream";

export class GoogleDriveStorageAdapter implements StorageAdapter {
  readonly id = "gdrive";

  private readonly client: DriveClient;
  private readonly rootFolderId: string;
  private readonly uploadChunkBytes: number;
  private readonly downloadChunkBytes: number;

  /** Directory path (`""`, `"chunks"`) → folder id. The root is seeded; the rest are found or made. */
  private readonly folders = new Map<string, Promise<string | undefined>>();
  /** Object path → file id, for paths already resolved. */
  private readonly fileIds = new Map<string, string>();
  /** Object path → size in bytes, from listings and our own writes. */
  private readonly sizes = new Map<string, number>();
  /**
   * Directories whose every child is known — listed in full by `list`, or created by us. For
   * these, a path missing from `fileIds` is known to be absent without asking Drive. A backup
   * lists the archive once up front, so checking "is this photo already there?" for hundreds of
   * photos costs no requests at all. (A file another device adds meanwhile is not seen until
   * the next adapter; sync's manifest check is what guards against that.)
   */
  private readonly completeDirs = new Set<string>();

  /** Present only when the client has a native uploader — see `uploadNative`. */
  readonly putFile?: (path: string, file: LocalFile, options?: PutFileOptions) => Promise<void>;

  constructor(options: GoogleDriveAdapterOptions) {
    if (options.client.uploadFile !== undefined) {
      this.putFile = (path, file, putOptions) => this.uploadNative(path, file, putOptions);
    }
    this.client = options.client;
    this.rootFolderId = options.rootFolderId;
    this.uploadChunkBytes = options.uploadChunkBytes ?? 32 * UPLOAD_GRANULE;
    this.downloadChunkBytes = options.downloadChunkBytes ?? 4 * 1024 * 1024;
    if (this.uploadChunkBytes <= 0 || this.uploadChunkBytes % UPLOAD_GRANULE !== 0) {
      throw new RangeError("uploadChunkBytes must be a positive multiple of 256 KiB");
    }
    if (this.downloadChunkBytes <= 0) throw new RangeError("downloadChunkBytes must be positive");
    this.folders.set("", Promise.resolve(this.rootFolderId));
  }

  capabilities(): StorageCapabilities {
    // Drive is the one destination all three clients can reach — including the web viewer,
    // which reads a shared archive folder directly from Drive.
    return { streaming: true, webReadable: true };
  }

  async put(path: string, data: Uint8Array): Promise<void> {
    const { dir, name } = split(path);
    const existing = await this.findFile(path);

    if (existing !== undefined) {
      // A media upload replaces the content whole, so a shorter rewrite leaves no tail.
      const updated = await this.client.request(
        `${DRIVE_UPLOAD_API}/files/${existing}?uploadType=media&fields=id`,
        { method: "PATCH", headers: { "Content-Type": mimeTypeOf(name) }, body: Uint8Array.from(data) },
        [200, 404],
      );
      if (updated.status === 200) {
        this.sizes.set(path, data.byteLength);
        return;
      }
      // The cached id went stale — deleted in the Drive UI since we looked. Write it afresh.
      this.fileIds.delete(path);
    }

    const parentId = await this.folderId(dir, true);
    const boundary = `boydem-${randomHex(24)}`;
    const created = await this.client.json<DriveFile>(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipart(boundary, { name, parents: [parentId!], mimeType: mimeTypeOf(name) }, data),
      },
    );
    this.fileIds.set(path, created.id);
    this.sizes.set(path, data.byteLength);
  }

  async get(path: string): Promise<Uint8Array> {
    return this.withFile(path, async (fileId) => {
      const response = await this.client.request(
        `${DRIVE_API}/files/${fileId}?alt=media`,
        { method: "GET", headers: {} },
      );
      return new Uint8Array(await response.arrayBuffer());
    });
  }

  async has(path: string): Promise<boolean> {
    return (await this.findFile(path)) !== undefined;
  }

  async list(prefix: string): Promise<string[]> {
    // Start at the deepest folder the prefix fully names, rather than walking the whole
    // archive to answer `list("media/")`.
    const slash = prefix.lastIndexOf("/");
    const startDir = slash === -1 ? "" : prefix.slice(0, slash);
    const startId = await this.folderId(startDir, false);
    if (startId === undefined) return [];

    const found = new Set<string>();
    const queue: { id: string; dir: string }[] = [{ id: startId, dir: startDir }];
    while (queue.length > 0) {
      const { id, dir } = queue.shift()!;
      const children = await this.client.listFiles(
        `${quote(id)} in parents and trashed = false`,
        "modifiedTime desc",
      );
      this.completeDirs.add(dir);
      for (const child of children) {
        const childPath = dir === "" ? child.name : `${dir}/${child.name}`;
        if (child.mimeType === FOLDER_MIME) {
          if (!this.folders.has(childPath)) this.folders.set(childPath, Promise.resolve(child.id));
          queue.push({ id: child.id, dir: childPath });
        } else if (!found.has(childPath)) {
          // Newest first, so the id cached for a duplicated name is the one reads should use.
          found.add(childPath);
          this.fileIds.set(childPath, child.id);
          if (child.size !== undefined) this.sizes.set(childPath, Number(child.size));
        }
      }
    }
    return [...found].filter((path) => path.startsWith(prefix));
  }

  async remove(path: string): Promise<void> {
    const { dir, name } = split(path);
    this.fileIds.delete(path);
    this.sizes.delete(path);
    const parentId = await this.folderId(dir, false);
    if (parentId === undefined) return;

    for (const file of await this.filesNamed(parentId, name)) {
      await this.client.request(
        `${DRIVE_API}/files/${file.id}?fields=id`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: '{"trashed":true}',
        },
        // Already gone — removing is idempotent by contract.
        [200, 404],
      );
    }
  }

  /**
   * Resumable upload: the stream is cut into `uploadChunkBytes` pieces, each sent as it fills,
   * so memory holds at most one chunk however large the blob. If the connection drops mid-chunk,
   * the session is asked how much it received and the upload resumes from there.
   */
  async putStream(path: string, data: AsyncIterable<Uint8Array>): Promise<void> {
    const sessionUrl = await this.openUploadSession(path);

    // Parts are copied on arrival (a producer may reuse its buffer after yielding) and joined
    // only when a whole chunk is ready — joining on every part would copy each byte once per
    // small part that followed it.
    const parts: Uint8Array[] = [];
    let buffered = 0;
    let sent = 0;
    for await (const part of data) {
      if (part.byteLength === 0) continue;
      parts.push(part.slice());
      buffered += part.byteLength;
      // Strictly more than a chunk: the last chunk must be sent as final, and until the stream
      // ends we cannot know that a chunk-sized remainder is the last one.
      while (buffered > this.uploadChunkBytes) {
        const chunk = takeFront(parts, this.uploadChunkBytes);
        buffered -= chunk.byteLength;
        await this.sendChunk(sessionUrl, chunk, sent, undefined);
        sent += chunk.byteLength;
      }
    }
    const last = takeFront(parts, buffered);
    const finished = await this.sendChunk(sessionUrl, last, sent, sent + last.byteLength);
    const created = JSON.parse(await finished.text()) as DriveFile;
    this.fileIds.set(path, created.id);
    this.sizes.set(path, sent + last.byteLength);
  }

  /**
   * Upload a file straight from disk with the client's native uploader: one request to open a
   * resumable session, then the platform sends the whole file to it — on iOS in a background
   * URLSession, so it runs at network speed and survives the app being backgrounded. Without an
   * uploader, falls back to streaming through `fetch`.
   */
  private async uploadNative(path: string, file: LocalFile, options?: PutFileOptions): Promise<void> {
    const uploader = this.client.uploadFile!;
    const { name } = split(path);
    const sessionUrl = await this.openUploadSession(path);
    const pending = uploader(sessionUrl, file.uri, { "Content-Type": mimeTypeOf(name) }, options?.onProgress);
    options?.onQueued?.();
    const result = await pending;
    if (result.status !== 200 && result.status !== 201) {
      throw new DriveError(result.status, undefined, `Uploading ${name} to Google Drive failed: ${result.status}`);
    }
    const created = JSON.parse(result.body) as DriveFile;
    this.fileIds.set(path, created.id);
    this.sizes.set(path, file.size);
  }

  async sizeOf(path: string): Promise<number | undefined> {
    const known = this.sizes.get(path);
    if (known !== undefined) return known;
    const fileId = await this.findFile(path);
    if (fileId === undefined) return undefined;
    const meta = await this.client.json<DriveFile>(`${DRIVE_API}/files/${fileId}?fields=size`, {
      method: "GET",
      headers: {},
    });
    const size = Number(meta.size ?? "0");
    this.sizes.set(path, size);
    return size;
  }

  async *getStream(path: string): AsyncIterable<Uint8Array> {
    const fileId = await this.findFile(path);
    if (fileId === undefined) throw new ObjectNotFoundError(path);

    const meta = await this.client.json<DriveFile>(`${DRIVE_API}/files/${fileId}?fields=size`, {
      method: "GET",
      headers: {},
    });
    const size = Number(meta.size ?? "0");
    for (let start = 0; start < size; start += this.downloadChunkBytes) {
      const end = Math.min(start + this.downloadChunkBytes, size) - 1;
      const response = await this.client.request(
        `${DRIVE_API}/files/${fileId}?alt=media`,
        { method: "GET", headers: { Range: `bytes=${start}-${end}` } },
        [200, 206],
      );
      const bytes = new Uint8Array(await response.arrayBuffer());
      // A server that ignores Range answers 200 with the whole file; take the slice we asked for.
      yield response.status === 200 ? bytes.slice(start, end + 1) : bytes;
    }
  }

  // ── internals ────────────────────────────────────────────────────────────────────────────

  /** A resumable upload session for `path` — updating the existing file, or creating one. */
  private async openUploadSession(path: string): Promise<string> {
    const { dir, name } = split(path);
    const existing = await this.findFile(path);
    const json = { "Content-Type": "application/json; charset=UTF-8" };
    let session =
      existing === undefined
        ? undefined
        : await this.client.request(
            `${DRIVE_UPLOAD_API}/files/${existing}?uploadType=resumable&fields=id`,
            { method: "PATCH", headers: json, body: asciiJson({ mimeType: mimeTypeOf(name) }) },
            [200, 404],
          );
    if (session === undefined || session.status === 404) {
      this.fileIds.delete(path);
      session = await this.client.request(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id`, {
        method: "POST",
        headers: json,
        body: asciiJson({ name, parents: [(await this.folderId(dir, true))!], mimeType: mimeTypeOf(name) }),
      });
    }
    const sessionUrl = session.headers.get("Location") ?? session.headers.get("location");
    if (sessionUrl === null) {
      throw new DriveError(session.status, undefined, "Drive did not return a resumable upload session");
    }
    return sessionUrl;
  }

  /**
   * One chunk of a resumable upload. `total` is known only for the final chunk; before that
   * Drive answers 308 ("resume incomplete"). On a failure the session is queried for what it
   * actually committed, and the rest of this chunk is re-sent — at most a few times.
   */
  private async sendChunk(
    sessionUrl: string,
    chunk: Uint8Array,
    offset: number,
    total: number | undefined,
  ) {
    const final = total !== undefined;
    let committed = offset;

    for (let attempt = 1; ; attempt += 1) {
      const body = chunk.subarray(committed - offset);
      const range =
        body.byteLength === 0
          ? `bytes */${total ?? "*"}`
          : `bytes ${committed}-${committed + body.byteLength - 1}/${total ?? "*"}`;
      try {
        return await this.client.request(
          sessionUrl,
          { method: "PUT", headers: { "Content-Range": range, "Content-Type": OCTET }, body: Uint8Array.from(body) },
          final ? [200, 201] : [308],
          // Not the client's blind retry: after a dropped connection some of these bytes may
          // already be committed, and re-sending them as-is would put the wrong range on the wire.
          { attempts: 1 },
        );
      } catch (error) {
        const transient =
          !(error instanceof DriveError) || error.status >= 500 || error.status === 429;
        if (!transient || attempt >= 5) throw error;
        committed = await this.committedBytes(sessionUrl, offset);
      }
    }
  }

  /** Ask a resumable session how many bytes it holds. Never less than `floor`, which it acknowledged. */
  private async committedBytes(sessionUrl: string, floor: number): Promise<number> {
    const status = await this.client.request(
      sessionUrl,
      { method: "PUT", headers: { "Content-Range": "bytes */*" } },
      [308, 200, 201],
    );
    const range = status.headers.get("Range") ?? status.headers.get("range");
    const match = range === null ? null : /bytes=0-(\d+)/.exec(range);
    return match === null ? floor : Math.max(floor, Number(match[1]) + 1);
  }

  /** Runs `use` with the file's id, retrying once with a fresh lookup if a cached id is stale. */
  private async withFile<T>(path: string, use: (fileId: string) => Promise<T>): Promise<T> {
    const cached = this.fileIds.has(path);
    const fileId = await this.findFile(path);
    if (fileId === undefined) throw new ObjectNotFoundError(path);
    try {
      return await use(fileId);
    } catch (error) {
      if (!(error instanceof DriveError && error.status === 404)) throw error;
      this.fileIds.delete(path);
      if (!cached) throw new ObjectNotFoundError(path);
      const fresh = await this.findFile(path);
      if (fresh === undefined) throw new ObjectNotFoundError(path);
      return use(fresh);
    }
  }

  private async findFile(path: string): Promise<string | undefined> {
    const cached = this.fileIds.get(path);
    if (cached !== undefined) return cached;

    const { dir, name } = split(path);
    // Everything in this folder is already known, and this path is not among it.
    if (this.completeDirs.has(dir)) return undefined;
    const parentId = await this.folderId(dir, false);
    if (parentId === undefined) return undefined;
    const newest = (await this.filesNamed(parentId, name))[0];
    if (newest !== undefined) this.fileIds.set(path, newest.id);
    return newest?.id;
  }

  /** Files (not folders) with this exact name in this folder, newest first. */
  private async filesNamed(parentId: string, name: string): Promise<DriveFile[]> {
    return this.client.listFiles(
      `name = ${quote(name)} and ${quote(parentId)} in parents and ` +
        `mimeType != ${quote(FOLDER_MIME)} and trashed = false`,
      "modifiedTime desc",
    );
  }

  /**
   * The id of the folder at `dir`, creating missing levels when `create` is set.
   *
   * Memoized as a *promise*, so ten parallel writes into `media/` wait on one lookup rather
   * than racing to create ten `media` folders. A lookup that found nothing is not memoized —
   * a later write may create it.
   */
  private folderId(dir: string, create: boolean): Promise<string | undefined> {
    const known = this.folders.get(dir);
    if (known !== undefined) {
      return known.then((id) => (id === undefined && create ? this.resolveFolder(dir, true) : id));
    }
    return this.resolveFolder(dir, create);
  }

  private resolveFolder(dir: string, create: boolean): Promise<string | undefined> {
    const slash = dir.lastIndexOf("/");
    const parentDir = slash === -1 ? "" : dir.slice(0, slash);
    const name = slash === -1 ? dir : dir.slice(slash + 1);

    const lookup = (async () => {
      const parentId = await this.folderId(parentDir, create);
      if (parentId === undefined) return undefined;
      // The parent was listed in full and this folder was not in it: no need to ask.
      if (this.completeDirs.has(parentDir)) {
        if (!create) return undefined;
        const made = (await this.client.createFolder(name, parentId)).id;
        this.completeDirs.add(dir);
        return made;
      }
      const existing = await this.client.listFiles(
        `name = ${quote(name)} and ${quote(parentId)} in parents and ` +
          `mimeType = ${quote(FOLDER_MIME)} and trashed = false`,
        // Oldest first: if two devices each made a `media` folder, every device picks the same one.
        "createdTime",
      );
      if (existing[0] !== undefined) return existing[0].id;
      if (!create) return undefined;
      const made = (await this.client.createFolder(name, parentId)).id;
      this.completeDirs.add(dir);
      return made;
    })();

    this.folders.set(dir, lookup);
    // Forget failures and misses, so the next call tries again instead of inheriting them.
    lookup.then(
      (id) => {
        if (id === undefined && this.folders.get(dir) === lookup) this.folders.delete(dir);
      },
      () => {
        if (this.folders.get(dir) === lookup) this.folders.delete(dir);
      },
    );
    return lookup;
  }
}

/**
 * The type Drive should show a file as. A photo uploaded as `application/octet-stream` is an
 * opaque blob in Drive; as `image/jpeg` it previews, thumbnails and opens like any photo — which
 * is what makes a plain archive's folder a copy the user can actually use without this app.
 */
const MIME_TYPES: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  "3gp": "video/3gpp",
  m4v: "video/x-m4v",
  opus: "audio/ogg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  pdf: "application/pdf",
  txt: "text/plain",
  json: "application/json",
  jsonl: "application/x-ndjson",
  vcf: "text/vcard",
};

export function mimeTypeOf(name: string): string {
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase();
  return (ext !== undefined ? MIME_TYPES[ext] : undefined) ?? OCTET;
}

function split(path: string): { dir: string; name: string } {
  const slash = path.lastIndexOf("/");
  return slash === -1
    ? { dir: "", name: path }
    : { dir: path.slice(0, slash), name: path.slice(slash + 1) };
}

/** A `multipart/related` body: JSON metadata, then the bytes. Built by hand so it stays binary-safe. */
function multipart(boundary: string, metadata: unknown, data: Uint8Array): Uint8Array {
  const head = asciiBytes(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${asciiJson(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${OCTET}\r\n\r\n`,
  );
  const tail = asciiBytes(`\r\n--${boundary}--`);
  return concat(concat(head, data), tail);
}

/** Remove exactly `length` bytes from the front of `parts`, joined into one array. */
function takeFront(parts: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let filled = 0;
  while (filled < length) {
    const head = parts[0]!;
    const needed = length - filled;
    if (head.byteLength <= needed) {
      out.set(head, filled);
      filled += head.byteLength;
      parts.shift();
    } else {
      out.set(head.subarray(0, needed), filled);
      filled += needed;
      parts[0] = head.subarray(needed);
    }
  }
  return out;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

/**
 * A multipart boundary. Not a secret, so `Math.random` is fine — it only has to be absent from
 * the body, and a 96-bit random string inside ciphertext is not a practical concern.
 */
function randomHex(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}
