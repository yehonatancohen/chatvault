/**
 * Opening a chat someone shared by link — no sign-in, no Boydem server.
 *
 * The owner's app turned on Google Drive's "anyone with the link can view" for the chat's folder
 * (`packages/storage/src/google-drive/sharing.ts`). This page reads that folder straight from
 * Drive with only the site's API key. A protected chat's key travels in the link's fragment
 * (`#k=`), which browsers never send anywhere — `fragment-key.ts`.
 */

import { ArchiveReader, createWebCryptoProvider, isPlainHeader, readHeader } from "@chatvault/core";
import { DriveClient, GoogleDriveStorageAdapter, type DriveFetch } from "@chatvault/storage";
import { MissingKeyError, readKeyFromFragment } from "./fragment-key";
import { GOOGLE_API_KEY } from "./site";

export class ChatUnavailableError extends Error {
  constructor() {
    super("הצ׳אט הזה כבר לא זמין. ייתכן שמי ששיתף אותו הפסיק את השיתוף.");
    this.name = "ChatUnavailableError";
  }
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
  const crypto = createWebCryptoProvider(window.crypto.subtle, (array) => window.crypto.getRandomValues(array));

  let archiveId: string;
  try {
    // One listing first: every later lookup (previews, photos) is answered from it.
    await storage.list("");
    const raw = JSON.parse(new TextDecoder().decode(await storage.get("header.json"))) as { archiveId?: unknown };
    if (typeof raw.archiveId !== "string") throw new ChatUnavailableError();
    archiveId = raw.archiveId;
  } catch (error) {
    if (error instanceof ChatUnavailableError) throw error;
    throw new ChatUnavailableError();
  }

  const header = await readHeader(storage, archiveId);
  if (isPlainHeader(header)) {
    const reader = await ArchiveReader.open({ crypto, storage, archiveId });
    return { reader, storage, archiveId, protected: false };
  }
  const key = readKeyFromFragment(hash); // throws MissingKeyError for a link without its key
  const reader = await ArchiveReader.open({ crypto, storage, key, archiveId });
  return { reader, storage, archiveId, protected: true };
}

export { MissingKeyError };
