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
  const remoteMedia = new Set(await remote.list(MEDIA_PREFIX));
  const ordered = pushOrder(localPaths);
  const next: Record<string, string> = { ...ledger };
  let copied = 0;
  let unchanged = 0;

  for (const [i, path] of ordered.entries()) {
    if (path.startsWith(MEDIA_PREFIX)) {
      if (remoteMedia.has(path)) {
        unchanged += 1;
      } else {
        await copy(local, remote, path);
        copied += 1;
      }
    } else {
      const bytes = await local.get(path);
      const hash = await options.sha256Hex(bytes);
      if (next[path] === hash && (await remote.has(path))) {
        unchanged += 1;
      } else {
        await remote.put(path, bytes);
        next[path] = hash;
        copied += 1;
        await options.onLedger?.({ ...next });
      }
    }
    options.onProgress?.({ done: i + 1, total: ordered.length, path });
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
  options: SyncOptions,
): Promise<SyncLedger> {
  if (await local.has(HEADER_PATH)) {
    throw new Error("This archive is already on this device; restoring would overwrite it.");
  }
  if (!(await remote.has(HEADER_PATH)) || (await manifestPath(remote)) === undefined) {
    throw new Error("The copy in Drive is incomplete — it was never fully backed up.");
  }

  const ordered = pullOrder(await remote.list(""));
  const ledger: Record<string, string> = {};
  for (const [i, path] of ordered.entries()) {
    if (path.startsWith(MEDIA_PREFIX)) {
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
  const media = paths.filter((p) => p.startsWith(MEDIA_PREFIX)).sort();
  const middle = paths.filter((p) => !p.startsWith(MEDIA_PREFIX) && !TAIL.has(p)).sort();
  return [...media, ...middle, ...tail.filter((p) => paths.includes(p))];
}

/**
 * One object, streamed when both sides can — a video is copied chunk by chunk rather than held
 * whole in memory on a phone.
 */
async function copy(from: StorageAdapter, to: StorageAdapter, path: string): Promise<void> {
  if (from.getStream && to.putStream && from.capabilities().streaming && to.capabilities().streaming) {
    await to.putStream(path, from.getStream(path));
  } else {
    await to.put(path, await from.get(path));
  }
}
