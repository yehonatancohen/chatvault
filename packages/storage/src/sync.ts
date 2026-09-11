import {
  HEADER_PATH,
  INDEX_PATH,
  MANIFEST_PATH,
  PLAIN_INDEX_PATH,
  PLAIN_MANIFEST_PATH,
  TRANSCRIPT_PATH,
} from "@chatvault/core";
import type { StorageAdapter } from "./adapter.js";

/**
 * Copying one archive between two storages — the phone and the user's Google Drive — without
 * ever needing its key.
 *
 * Everything here moves bytes exactly as stored. It never decrypts, so it works for any archive —
 * plain, or protected whether or not this device holds the key.
 *
 * **What changes and what does not**, which decides what a sync must re-send:
 *
 * - `media/<sha256>.enc` is written once and never again — the path *is* the content address.
 *   Present at the destination means done.
 * - Everything else can be rewritten: `ArchiveWriter.commit` re-seals a chunk whose messages
 *   changed (a new export can fill in a message's media, or add a source), and the manifest,
 *   index and header are whole-file rewrites. For these, the **ledger** remembers the SHA-256 of
 *   the exact bytes last sent, so an unchanged chunk is not uploaded twice and a changed one is
 *   never missed. Hashes are over ciphertext; the ledger reveals nothing about content.
 *
 * **Order is what keeps a half-finished sync harmless:**
 *
 * - Push writes the **manifest last**. Until it lands, a reader of the destination still sees
 *   the previous manifest, and every object it names is still there.
 * - Pull writes the **header last**. The app lists an archive only once its `header.json`
 *   exists (`listArchiveIds`), so an interrupted restore never shows up as a broken chat.
 *
 * **Two devices, one Drive folder.** Before pushing, the destination's manifest is compared
 * with what this device last sent. If someone else has written since, the push stops and says
 * so rather than overwriting their work; merging two diverged archives needs the key and
 * `core`'s merge, and is deliberately not attempted here.
 *
 * Works the same for protected (sealed) and plain archives: the two layouts differ only in file
 * names (`manifest.json.enc` vs `manifest.json`, …), and this file knows both.
 *
 * Nothing is ever deleted from either side (`packages/storage/CLAUDE.md`).
 */

/** Path → hex SHA-256 of the bytes last copied to the destination. Media is not tracked. */
export type SyncLedger = Readonly<Record<string, string>>;

export interface SyncProgress {
  readonly done: number;
  readonly total: number;
  /** The path just copied, for a progress line that shows something moving. */
  readonly path: string;
  /**
   * Bytes of this sync's uploads sent so far, and in all. A progress bar should use these: a
   * chat is a few big videos and many small files, and counting files misleads badly.
   */
  readonly bytesDone?: number;
  readonly bytesTotal?: number;
}

export interface SyncOptions {
  readonly sha256Hex: (bytes: Uint8Array) => Promise<string>;
  /** Called after every object, so an interrupted sync resumes rather than restarts. */
  readonly onLedger?: (ledger: SyncLedger) => Promise<void>;
  readonly onProgress?: (progress: SyncProgress) => void;
}

export type PushResult =
  | { readonly kind: "pushed"; readonly ledger: SyncLedger; readonly copied: number; readonly unchanged: number }
  /** The destination changed since this device last pushed. Nothing was written. */
  | { readonly kind: "diverged" };

const MEDIA_PREFIX = "media/";
/** Photo previews: content-addressed like media, but small — never offloaded, always restored. */
const THUMBS_PREFIX = "thumbs/";
/** Written once and never changed, so present at the destination means done. */
const isContentAddressed = (path: string) => path.startsWith(MEDIA_PREFIX) || path.startsWith(THUMBS_PREFIX);
const MANIFESTS = [MANIFEST_PATH, PLAIN_MANIFEST_PATH];
const INDEXES = [INDEX_PATH, PLAIN_INDEX_PATH];
const TAIL = new Set([...INDEXES, TRANSCRIPT_PATH, HEADER_PATH, ...MANIFESTS]);

/** Whichever manifest this archive has — sealed or plain. */
async function manifestPath(storage: StorageAdapter): Promise<string | undefined> {
  for (const path of MANIFESTS) if (await storage.has(path)) return path;
  return undefined;
}

/**
 * Bring `remote` up to date with `local`.
 *
 * `ledger` is what this device recorded at its last push to this destination (`{}` for never).
 */
export async function pushArchive(
  local: StorageAdapter,
  remote: StorageAdapter,
  ledger: SyncLedger,
  options: SyncOptions,
): Promise<PushResult> {
  const manifest = await manifestPath(local);
  if (manifest === undefined) {
    throw new Error("Nothing to back up: this archive has no manifest yet.");
  }

  // Divergence: the destination's manifest must be the one we last sent, or byte-identical to
  // ours. Anything else was written by another device.
  if (await remote.has(manifest)) {
    const theirs = await options.sha256Hex(await remote.get(manifest));
    const ours = await options.sha256Hex(await local.get(manifest));
    if (theirs !== ledger[manifest] && theirs !== ours) return { kind: "diverged" };
  }

  const localPaths = await local.list("");
  // One listing of the whole destination up front. Besides telling us what is there, it lets
  // the Drive adapter answer every later "is this here?" without a request.
  const remotePaths = new Set(await remote.list(""));
  const ordered = pushOrder(localPaths);
  const media = ordered.filter(isContentAddressed);
  const rest = ordered.filter((path) => !isContentAddressed(path));
  const next: Record<string, string> = { ...ledger };
  let copied = 0;
  let unchanged = 0;
  let done = 0;

  // Byte progress, over everything this sync will actually send.
  const toSend = new Map<string, number>();
  for (const path of media) {
    if (!remotePaths.has(path) || (await sizesDiffer(local, remote, path))) {
      toSend.set(path, (await local.sizeOf?.(path)) ?? 0);
    }
  }
  const bytesTotal = [...toSend.values()].reduce((sum, n) => sum + n, 0);
  const sent = new Map<string, number>();
  const bytesDone = () => [...sent.values()].reduce((sum, n) => sum + n, 0);
  const report = (path: string) =>
    options.onProgress?.({ done, total: ordered.length, path, bytesDone: bytesDone(), bytesTotal });
  const tick = (path: string) => {
    done += 1;
    report(path);
  };

  // Media first, and all of it queued at once when the destination has a native uploader: each
  // file is handed to the platform (a background URLSession on iOS) and this loop moves on
  // without waiting for it to finish, so every transfer is in the system's hands — running at
  // full speed, and continuing if the app goes to the background. Only opening the upload
  // sessions is rate-limited. Nothing names a new photo until the manifest lands last.
  const transfers: Promise<void>[] = [];
  await forEachLimit(media, UPLOAD_PARALLELISM, async (path) => {
    if (!toSend.has(path)) {
      unchanged += 1;
      tick(path);
      return;
    }
    const file = remote.putFile !== undefined ? await local.localFile?.(path) : undefined;
    if (file !== undefined && remote.putFile !== undefined) {
      await new Promise<void>((queued) => {
        const transfer = remote.putFile!(path, file, {
          onQueued: queued,
          onProgress: (bytes) => {
            sent.set(path, bytes);
            report(path);
          },
        }).then(() => {
          sent.set(path, file.size);
          copied += 1;
          tick(path);
        });
        transfer.catch(() => queued());
        transfers.push(transfer);
      });
    } else {
      await copy(local, remote, path);
      sent.set(path, toSend.get(path) ?? 0);
      copied += 1;
      tick(path);
    }
  });
  // Every transfer settles before the manifest is written; the first failure is reported after
  // the rest have had their chance, so one bad file does not strand the others.
  const failures = (await Promise.allSettled(transfers)).filter((r) => r.status === "rejected");
  if (failures.length > 0) throw (failures[0] as PromiseRejectedResult).reason;

  // Everything else strictly in order, the manifest last.
  for (const path of rest) {
    const bytes = await local.get(path);
    const hash = await options.sha256Hex(bytes);
    if (next[path] === hash && remotePaths.has(path)) {
      unchanged += 1;
    } else {
      await remote.put(path, bytes);
      next[path] = hash;
      copied += 1;
      await options.onLedger?.({ ...next });
    }
    tick(path);
  }

  return { kind: "pushed", ledger: { ...next }, copied, unchanged };
}

/**
 * Copy an archive that exists only at `remote` into an empty `local` — a restore onto a new
 * phone. Returns the ledger to keep for later pushes from this device.
 */
export async function pullArchive(
  remote: StorageAdapter,
  local: StorageAdapter,
  options: SyncOptions & {
    /**
     * Leave photos and files in Drive and copy only the messages. The app then fetches media
     * when it is looked at — a new phone gets its chats back without refilling its storage.
     */
    readonly skipMedia?: boolean;
  },
): Promise<SyncLedger> {
  if (await local.has(HEADER_PATH)) {
    throw new Error("This archive is already on this device; restoring would overwrite it.");
  }
  if (!(await remote.has(HEADER_PATH)) || (await manifestPath(remote)) === undefined) {
    throw new Error("The copy in Drive is incomplete — it was never fully backed up.");
  }

  const ordered = pullOrder(await remote.list("")).filter(
    (path) => !(options.skipMedia === true && path.startsWith(MEDIA_PREFIX)),
  );
  const ledger: Record<string, string> = {};
  for (const [i, path] of ordered.entries()) {
    if (isContentAddressed(path)) {
      await copy(remote, local, path);
    } else {
      const bytes = await remote.get(path);
      await local.put(path, bytes);
      ledger[path] = await options.sha256Hex(bytes);
    }
    options.onProgress?.({ done: i + 1, total: ordered.length, path });
  }
  await options.onLedger?.({ ...ledger });
  return ledger;
}

/** Media, then chunks and anything else, then index, transcript, header, and the manifest last. */
function pushOrder(paths: readonly string[]): string[] {
  return order(paths, [...INDEXES, TRANSCRIPT_PATH, HEADER_PATH, ...MANIFESTS]);
}

/** As push, but the header last — it is what makes the app list the archive. */
function pullOrder(paths: readonly string[]): string[] {
  return order(paths, [...INDEXES, TRANSCRIPT_PATH, ...MANIFESTS, HEADER_PATH]);
}

function order(paths: readonly string[], tail: readonly string[]): string[] {
  const media = paths.filter(isContentAddressed).sort();
  const middle = paths.filter((p) => !isContentAddressed(p) && !TAIL.has(p)).sort();
  return [...media, ...middle, ...tail.filter((p) => paths.includes(p))];
}

/**
 * Remove photos and files from the phone that the destination verifiably holds.
 *
 * This is the point of the product: once a chat is in the user's Drive, keeping a second copy
 * of every photo on the phone would fill it right back up. A file is removed locally only when
 * the destination lists it *and* reports exactly the same size — a partial or failed upload
 * never matches. Messages stay: they are small, and they make a chat open instantly and offline.
 * The app reads removed media back from Drive on demand.
 */
export async function offloadMedia(
  local: StorageAdapter,
  remote: StorageAdapter,
): Promise<{ readonly removed: number; readonly bytes: number }> {
  if (local.sizeOf === undefined || remote.sizeOf === undefined) return { removed: 0, bytes: 0 };
  const remoteMedia = new Set(await remote.list(MEDIA_PREFIX));
  let removed = 0;
  let bytes = 0;
  for (const path of await local.list(MEDIA_PREFIX)) {
    if (!remoteMedia.has(path)) continue;
    const [here, there] = await Promise.all([local.sizeOf(path), remote.sizeOf(path)]);
    if (here === undefined || here !== there) continue;
    await local.remove(path);
    removed += 1;
    bytes += here;
  }
  return { removed, bytes };
}

/**
 * A destination copy whose size is known and differs from ours is damaged (a cut-off upload,
 * or edited by hand) and is sent again. Unknown sizes count as matching.
 */
async function sizesDiffer(local: StorageAdapter, remote: StorageAdapter, path: string): Promise<boolean> {
  if (local.sizeOf === undefined || remote.sizeOf === undefined) return false;
  const [here, there] = await Promise.all([local.sizeOf(path), remote.sizeOf(path)]);
  return here !== undefined && there !== undefined && here !== there;
}

/**
 * How many media uploads run at once through `fetch`, or — with a native uploader — how many
 * upload sessions are opened at once (the transfers themselves are all queued to the platform).
 */
const UPLOAD_PARALLELISM = 6;
/** Above this a file is streamed; below it, sent whole in one request. */
const STREAM_ABOVE_BYTES = 5 * 1024 * 1024;

/**
 * One object. Small files go whole — one request instead of a resumable session's three — and
 * large ones stream, so a video is never held whole in memory on a phone.
 */
async function copy(from: StorageAdapter, to: StorageAdapter, path: string): Promise<void> {
  const size = await from.sizeOf?.(path);
  const canStream =
    from.getStream !== undefined &&
    to.putStream !== undefined &&
    from.capabilities().streaming &&
    to.capabilities().streaming;
  if (canStream && (size === undefined || size > STREAM_ABOVE_BYTES)) {
    await to.putStream!(path, from.getStream!(path));
  } else {
    await to.put(path, await from.get(path));
  }
}

async function forEachLimit<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await work(item);
    }
  });
  await Promise.all(runners);
}
