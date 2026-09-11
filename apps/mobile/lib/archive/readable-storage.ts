/**
 * Storage for *reading* a chat: this phone first, then the user's Google Drive.
 *
 * Once a chat is backed up, its photos are removed from the phone (`offloadMedia`) — keeping a
 * second copy would defeat the point of archiving. Messages stay local; photos come back from
 * Drive when a screen actually shows one. Writes always go to the phone (`storageFor`): an
 * import never writes to Drive directly, the backup does.
 *
 * Recently fetched photos are kept in memory (not on disk — that would refill the phone) so
 * scrolling back through a gallery does not download the same photo twice.
 */

import { ObjectNotFoundError } from "@chatvault/storage";
import type { ArchiveStoragePort } from "@chatvault/core";
import { remoteFor } from "../drive/drive-client";
import { storageFor } from "./vault";

const MEDIA_PREFIX = "media/";
const CACHE_LIMIT_BYTES = 40 * 1024 * 1024;
const cache = new Map<string, Uint8Array>();
let cachedBytes = 0;

export function readableStorageFor(archiveId: string): ArchiveStoragePort {
  const local = storageFor(archiveId);
  return {
    put: (path, data) => local.put(path, data),
    async has(path) {
      if (await local.has(path)) return true;
      if (!path.startsWith(MEDIA_PREFIX)) return false;
      try {
        return await (await remoteFor(archiveId)).has(path);
      } catch {
        return false;
      }
    },
    async get(path) {
      try {
        return await local.get(path);
      } catch (error) {
        if (!(error instanceof ObjectNotFoundError) || !path.startsWith(MEDIA_PREFIX)) throw error;
      }
      const key = `${archiveId}/${path}`;
      const hit = cache.get(key);
      if (hit !== undefined) {
        // Refresh recency: Map iteration order is insertion order.
        cache.delete(key);
        cache.set(key, hit);
        return hit;
      }
      const bytes = await (await remoteFor(archiveId)).get(path);
      remember(key, bytes);
      return bytes;
    },
  };
}

function remember(key: string, bytes: Uint8Array): void {
  if (bytes.byteLength > CACHE_LIMIT_BYTES / 4) return; // a video would evict everything else
  cache.set(key, bytes);
  cachedBytes += bytes.byteLength;
  for (const [oldest, value] of cache) {
    if (cachedBytes <= CACHE_LIMIT_BYTES) break;
    cache.delete(oldest);
    cachedBytes -= value.byteLength;
  }
}
