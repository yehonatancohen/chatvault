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

export async function openSharedChat(folderId: string, hash: string): Promise<ArchiveReader> {
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
  if (isPlainHeader(header)) return ArchiveReader.open({ crypto, storage, archiveId });
  const key = readKeyFromFragment(hash); // throws MissingKeyError for a link without its key
  return ArchiveReader.open({ crypto, storage, key, archiveId });
}

export { MissingKeyError };
