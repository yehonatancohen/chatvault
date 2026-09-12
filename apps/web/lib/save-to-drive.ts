/**
 * Keeping a chat someone shared with you — as a copy in **your** Google Drive.
 *
 * A file-for-file copy of the owner's shared folder into `My Drive/Boydem/<chat>/` in the
 * visitor's own Drive, with the same `pullArchive` the app uses to restore a chat onto a new
 * phone. Nothing is re-encoded and nothing passes through Boydem: the bytes go from the owner's
 * Drive to this browser to the visitor's Drive, and a protected chat is copied still sealed —
 * its key stays in this tab's memory and is never written to the copy (root `CLAUDE.md`,
 * invariant 2).
 *
 * The result is a chat the **app** can then pick up: it lands in the same `Boydem` folder, with
 * the same layout, under the archive's own id — so "Download them" on the app's Account tab
 * finds it, on any phone signed into that Google account. That is what makes this worth doing
 * in a browser at all, and it is why the copy counts as one of the visitor's chats.
 */

import { HEADER_PATH } from "@chatvault/core";
import {
  DriveClient,
  GoogleDriveStorageAdapter,
  ensureAppFolder,
  ensureArchiveFolder,
  pullArchive,
  type DriveFetch,
} from "@chatvault/storage";
import type { SharedChat } from "./shared-chat";

/** What a folder is called when the chat is protected and its title is sealed. Matches the app. */
const PROTECTED_FOLDER_NAME = "צ׳אט מוגן";

export interface SaveProgress {
  readonly done: number;
  readonly total: number;
}

/** The visitor's Drive already holds this chat — nothing was copied, and nothing is wrong. */
export class AlreadySavedError extends Error {
  constructor(readonly folderUrl: string) {
    super("הצ׳אט הזה כבר שמור ב-Google Drive שלכם.");
    this.name = "AlreadySavedError";
  }
}

export interface SaveResult {
  /** Where the copy landed, for a link the visitor can open. */
  readonly folderUrl: string;
}

export async function saveToMyDrive(
  chat: SharedChat,
  accessToken: string,
  onProgress: (progress: SaveProgress) => void,
): Promise<SaveResult> {
  const client = new DriveClient({
    fetch: driveFetch,
    // The token was handed over by the `/connect` window and lives only in this tab's memory.
    getAccessToken: async () => accessToken,
  });

  const appFolderId = await ensureAppFolder(client);
  const name = chat.protected ? PROTECTED_FOLDER_NAME : chat.reader.manifest.chatTitle.trim() || chat.archiveId;
  const folderId = await ensureArchiveFolder(client, appFolderId, chat.archiveId, name);
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  const destination = new GoogleDriveStorageAdapter({ client, rootFolderId: folderId });

  // `pullArchive` refuses to write over an archive that is already there, and says so in the
  // app's words ("already on this device"). Asking first is what turns that into the true and
  // calmer thing: you already have this one.
  //
  // The check is for a *finished* copy: the header is written last (`pullOrder`), so a copy
  // interrupted halfway has none, and trying again starts over rather than being refused. It
  // re-sends what it already sent — wasteful, not wrong, and the price of not tracking a ledger
  // for someone else's archive in a tab that may never come back.
  if (await destination.has(HEADER_PATH)) throw new AlreadySavedError(folderUrl);

  await pullArchive(chat.storage, destination, {
    sha256Hex: hashHex,
    onProgress: (progress) => onProgress({ done: progress.done, total: progress.total }),
  });

  return { folderUrl };
}

/**
 * The sync ledger's hash, through the browser's own SHA-256. Only the small files reach this —
 * media is content-addressed, so `pullArchive` never hashes a video.
 */
async function hashHex(bytes: Uint8Array): Promise<string> {
  // `Uint8Array.from` rather than the array itself: TypeScript's `BufferSource` insists on a
  // view over a plain `ArrayBuffer`, which a `Uint8Array<ArrayBufferLike>` is not proven to be.
  const digest = await window.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const driveFetch: DriveFetch = (url, init) =>
  fetch(url, {
    method: init.method,
    headers: init.headers,
    // As in `shared-chat.ts`: the bare origin, never a path and never the fragment.
    referrerPolicy: "origin",
    ...(init.body !== undefined ? { body: init.body as BodyInit } : {}),
  });
