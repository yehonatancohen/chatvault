/** Backed-up chats are read from Drive. Pending imports remain durable local staging. */
import { ObjectNotFoundError } from "@chatvault/storage";
import type { ArchiveStoragePort } from "@chatvault/core";
import { remoteFor } from "../drive/drive-client";
import { readViewBackupState } from "./location";
import { accountEmail, assertDriveSession, sessionGeneration, subscribeDriveSession } from "../drive/session";
import { storageFor } from "./vault";

const CACHE_LIMIT_BYTES = 40 * 1024 * 1024;
const cache = new Map<string, Uint8Array>();
let cachedBytes = 0;
subscribeDriveSession(() => { cache.clear(); cachedBytes = 0; });

export function readableStorageFor(archiveId: string): ArchiveStoragePort {
  const generation = sessionGeneration();
  const local = storageFor(archiveId);
  async function source() {
    if (generation !== sessionGeneration()) throw new Error("Google Drive account changed.");
    const state = await readViewBackupState(archiveId);
    if (state.accountEmail && state.accountEmail !== accountEmail()) throw new Error("Connect the Google account that owns this chat.");
    // Legacy completed backups are hidden until their owning account is verified by discovery.
    if (!state.accountEmail && state.backedUpAt && !accountEmail()) throw new Error("Connect Google Drive to read this chat.");
    if (state.cloudOnly) { assertDriveSession(generation); return remoteFor(archiveId); }
    return local;
  }
  return {
    async put(path, data) { await source(); await local.put(path, data); },
    async has(path) {
      const storage = await source();
      if (await storage.has(path)) return true;
      if (storage === local && accountEmail() && /^(media|thumbs)\//.test(path)) return (await remoteFor(archiveId)).has(path);
      return false;
    },
    async get(path) {
      const storage = await source();
      if (storage === local) {
        try {
          const bytes = await local.get(path);
          if (generation !== sessionGeneration()) throw new Error("Google Drive account changed.");
          return bytes;
        }
        catch (error) { if (!(error instanceof ObjectNotFoundError) || !/^(media|thumbs)\//.test(path)) throw error; }
      }
      assertDriveSession(generation);
      // Manifest and message chunks can change on any device. Cache only immutable blobs,
      // otherwise an append can appear to disappear behind an older cached manifest.
      if (!/^(media|thumbs)\//.test(path)) {
        const bytes = await (await remoteFor(archiveId)).get(path);
        assertDriveSession(generation);
        return bytes;
      }
      const cacheKey = `${generation}/${archiveId}/${path}`;
      const hit = cache.get(cacheKey);
      if (hit) { cache.delete(cacheKey); cache.set(cacheKey, hit); return hit; }
      const bytes = await (await remoteFor(archiveId)).get(path);
      assertDriveSession(generation);
      if (bytes.byteLength <= CACHE_LIMIT_BYTES / 4) {
        cache.set(cacheKey, bytes); cachedBytes += bytes.byteLength;
        for (const [oldest, value] of cache) {
          if (cachedBytes <= CACHE_LIMIT_BYTES) break;
          cache.delete(oldest); cachedBytes -= value.byteLength;
        }
      }
      return bytes;
    },
  };
}
