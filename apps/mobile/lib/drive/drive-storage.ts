/**
 * Google Drive on the phone: the adapter from `@chatvault/storage`, wired to `expo/fetch`.
 *
 * `expo/fetch` rather than React Native's global `fetch`, because the global one is built on
 * XHR and hands binary responses back through a blob/FileReader path that has been unreliable
 * across RN versions — and every byte this carries is ciphertext that must round-trip exactly.
 *
 * **Where the token comes from is deliberately not decided here.** `getAccessToken` is injected
 * so that the Google sign-in (Phase 1 of `ACCOUNTS-AND-CLOUD.md`) can plug in once it exists,
 * and so that the dev screen can run the real-Drive contract today with a pasted token.
 *
 * Nothing in this file talks to Boydem's servers. Bytes go from this phone to the user's own
 * Drive and back (root `CLAUDE.md`, invariant 2).
 */

import { fetch as expoFetch } from "expo/fetch";
import {
  createUploadTask,
  FileSystemSessionType,
  FileSystemUploadType,
} from "expo-file-system/legacy";
import {
  DriveClient,
  ensureAppFolder,
  ensureArchiveFolder,
  GoogleDriveStorageAdapter,
  type DriveClientOptions,
  type DriveFetch,
  type FileUploader,
} from "@chatvault/storage";

export type AccessTokenProvider = DriveClientOptions["getAccessToken"];

const driveFetch: DriveFetch = (url, init) =>
  expoFetch(url, {
    method: init.method,
    headers: init.headers,
    ...(init.body !== undefined ? { body: init.body } : {}),
  });

/**
 * Uploads a file straight from disk with a **background URLSession** (iOS) — `expo-file-system`'s
 * legacy upload task, which is the part of it that exposes one.
 *
 * This is what makes backups fast and hands-off: the bytes never pass through JS (reading a
 * photo into JS, copying it and bridging it to `fetch` was what capped uploads at a fraction of
 * the connection), and the system keeps transferring while the app is in the background — or
 * after iOS suspends it. A task that completes while JS is suspended resolves when the app next
 * comes to the foreground; the backup then finishes with the manifest.
 */
const uploadFile: FileUploader = async (url, fileUri, headers, onProgress) => {
  const task = createUploadTask(
    url,
    fileUri,
    {
      httpMethod: "PUT",
      headers: { ...headers },
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystemSessionType.BACKGROUND,
    },
    onProgress !== undefined ? (progress) => onProgress(progress.totalBytesSent) : undefined,
  );
  const result = await task.uploadAsync();
  return { status: result?.status ?? 0, body: result?.body ?? "" };
};

export function createDriveClient(getAccessToken: AccessTokenProvider): DriveClient {
  return new DriveClient({ fetch: driveFetch, getAccessToken, uploadFile });
}

/**
 * The storage for one archive in the user's Drive: `My Drive/Boydem/<name>/`. The folder is
 * found by the archive's id (not its name) and renamed to `name` if it differs — so a folder
 * always carries the chat's current title. Returns the folder id too, for "open in Drive".
 */
export async function driveStorageFor(
  client: DriveClient,
  archiveId: string,
  name?: string,
): Promise<{ storage: GoogleDriveStorageAdapter; folderId: string }> {
  const appFolderId = await ensureAppFolder(client);
  const folderId = await ensureArchiveFolder(client, appFolderId, archiveId, name);
  return { storage: new GoogleDriveStorageAdapter({ client, rootFolderId: folderId }), folderId };
}

/** The web address of a folder in Google Drive; opens the Drive app when it is installed. */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
