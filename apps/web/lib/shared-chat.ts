/**
 * Opening a chat someone shared by link — no sign-in, no Boydem server.
 *
 * The owner's app turned on Google Drive's "anyone with the link can view" for the chat's folder
 * (`packages/storage/src/google-drive/sharing.ts`). This page reads that folder straight from
 * Drive with only the site's API key. A protected chat's key travels in the link's fragment
 * (`#k=`), which browsers never send anywhere — `fragment-key.ts`.
 *
 * **Opening is latency-bound, and the shape of this file is mostly about that.** Every step is a
 * Drive round trip from the visitor's browser, and they used to run one after another: list the
 * folder, read the header, read it again to validate it, read it a third time inside the reader,
 * read the manifest, then read every chunk in a loop. A long chat took that many round trips
 * before a single message appeared. Two things fix it, and neither weakens a check:
 *
 * - `metadataCache` below, so the header is fetched once rather than three times.
 * - `loadNewestFirst`, so the viewer paints as soon as the newest chunk lands and the rest of
 *   the conversation streams in behind it. The viewer opens at the end anyway, which is the
 *   only reason this is honest rather than a trick: what you see first is what you asked for.
 */

import {
  ArchiveReader,
  createWebCryptoProvider,
  isPlainHeader,
  readHeader,
  type ArchiveStoragePort,
  type MergedMessage,
} from "@chatvault/core";
import { DriveClient, GoogleDriveStorageAdapter, type DriveFetch } from "@chatvault/storage";
import { MissingKeyError, readKeyFromFragment } from "./fragment-key";
import { GOOGLE_API_KEY } from "./site";

export class ChatUnavailableError extends Error {
  constructor() {
    super("הצ׳אט הזה כבר לא זמין. ייתכן שמי ששיתף אותו הפסיק לשתף אותו.");
    this.name = "ChatUnavailableError";
  }
}

/**
 * The archive's small metadata files, memoized for the life of the page.
 *
 * `header.json` alone was fetched three times while opening: once here for the archive id, once
 * by `readHeader` to validate it, and once more inside `ArchiveReader.open`. Each of those is a
 * separate network round trip for a file of a few hundred bytes. Only these fixed paths are
 * cached — chunks and media are not, because caching those would mean holding the whole chat's
 * ciphertext in memory on top of the messages already decoded from it.
 *
 * Keyed on the promise rather than the result so two callers racing for the header share one
 * request instead of making two.
 */
const CACHEABLE = new Set(["header.json", "manifest.json", "manifest.json.enc", "index.json", "index.json.enc"]);

function metadataCache(storage: ArchiveStoragePort): ArchiveStoragePort {
  const inFlight = new Map<string, Promise<Uint8Array>>();
  return {
    put: (path, data) => storage.put(path, data),
    has: (path) => storage.has(path),
    get(path) {
      if (!CACHEABLE.has(path)) return storage.get(path);
      const hit = inFlight.get(path);
      if (hit !== undefined) return hit;
      // A rejected read is dropped, so a transient failure does not poison the page.
      const pending = storage.get(path).catch((error: unknown) => {
        inFlight.delete(path);
        throw error;
      });
      inFlight.set(path, pending);
      return pending;
    },
  };
}

/**
 * An open shared chat: the reader the viewer draws from, and the storage it came out of.
 *
 * The storage is kept because saving a copy into the visitor's own Drive is a file-for-file
 * copy of this folder (`save-to-drive.ts` → `pullArchive`), not a re-encode of what the reader
 * decrypted. A protected chat is therefore copied still sealed, and its key never leaves this
 * browser — the copy stays exactly as private as the original.
 */
export interface SharedChat {
  readonly reader: ArchiveReader;
  readonly storage: GoogleDriveStorageAdapter;
  readonly archiveId: string;
  /** True for a chat the owner protected with a passphrase (sealed, format v1). */
  readonly protected: boolean;
}

export async function openSharedChat(folderId: string, hash: string): Promise<SharedChat> {
  if (GOOGLE_API_KEY === "") throw new Error("שיתוף צ׳אטים עדיין לא מוגדר באתר הזה.");
  const browserFetch: DriveFetch = (url, init) =>
    fetch(url, {
      method: init.method,
      headers: init.headers,
      // The page's policy is "no-referrer", but a Google API key restricted to this website
      // is checked against the Referer. "origin" sends just `https://<site>/` — no path, so
      // no folder id, and never the fragment — which is exactly what the restriction needs.
      referrerPolicy: "origin",
      ...(init.body !== undefined ? { body: init.body as BodyInit } : {}),
    });
  const storage = new GoogleDriveStorageAdapter({
    client: new DriveClient({ fetch: browserFetch, apiKey: GOOGLE_API_KEY }),
    rootFolderId: folderId,
  });
  const cached = metadataCache(storage);
  const crypto = createWebCryptoProvider(window.crypto.subtle, (array) => window.crypto.getRandomValues(array));

  let archiveId: string;
  try {
    // One listing first: every later lookup (chunks, previews, photos) is answered from it,
    // and it walks the archive's folders a level at a time rather than one by one.
    await storage.list("");
    const raw = JSON.parse(new TextDecoder().decode(await cached.get("header.json"))) as { archiveId?: unknown };
    if (typeof raw.archiveId !== "string") throw new ChatUnavailableError();
    archiveId = raw.archiveId;
  } catch (error) {
    if (error instanceof ChatUnavailableError) throw error;
    throw new ChatUnavailableError();
  }

  const header = await readHeader(cached, archiveId);
  if (isPlainHeader(header)) {
    const reader = await ArchiveReader.open({ crypto, storage: cached, archiveId });
    return { reader, storage, archiveId, protected: false };
  }
  const key = readKeyFromFragment(hash); // throws MissingKeyError for a link without its key
  const reader = await ArchiveReader.open({ crypto, storage: cached, key, archiveId });
  return { reader, storage, archiveId, protected: true };
}

/**
 * Read the conversation newest chunk first, handing over each batch as it lands.
 *
 * The viewer opens at the last message, so the newest chunk is the only one needed to show a
 * usable chat; everything older is read behind it and prepended. `onOlder` is called with each
 * older batch **in reverse order** — the chunk just before the one already shown, then the one
 * before that — so the caller only ever prepends, and never has to reconcile a hole in the
 * middle.
 *
 * Older chunks are fetched a few at a time and still delivered in order, so scrolling up
 * during the load never reveals a gap. Cancellation is cooperative: `isStale` is checked
 * between batches, because a visitor who closed the tab should not keep pulling their friend's
 * archive out of Drive.
 */
export async function loadNewestFirst(
  reader: ArchiveReader,
  onNewest: (messages: MergedMessage[]) => void,
  onOlder: (messages: MergedMessage[]) => void,
  isStale: () => boolean,
): Promise<void> {
  const indices = reader.chunkIndices;
  if (indices.length === 0) {
    onNewest([]);
    return;
  }

  onNewest(await reader.readChunk(indices[indices.length - 1]!));

  // Newest-but-one backwards, in batches: within a batch the chunks are fetched concurrently,
  // and the batch is handed over youngest-first so each call is a pure prepend.
  const older = indices.slice(0, -1);
  const BATCH = 6;
  for (let end = older.length; end > 0; end -= BATCH) {
    if (isStale()) return;
    const start = Math.max(0, end - BATCH);
    const chunks = await reader.readChunks(older.slice(start, end), BATCH);
    if (isStale()) return;
    for (let i = chunks.length - 1; i >= 0; i--) onOlder(chunks[i]!);
  }
}

export { MissingKeyError };
