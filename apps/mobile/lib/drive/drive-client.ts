/**
 * The one Drive client this app uses, and each chat's Drive folder as storage.
 *
 * Its own module so that both the backup (`device-sync.ts`) and the reading path
 * (`lib/archive/readable-storage.ts`) can reach a chat's folder without importing each other.
 */

import { ensureAppFolder, GoogleDriveStorageAdapter, listArchiveFolders } from "@chatvault/storage";
import { readBackupState } from "./backup-state";
import { createDriveClient } from "./drive-storage";
import { googleAccessToken } from "./google-auth";

let client: ReturnType<typeof createDriveClient> | undefined;
export function driveClient() {
  client ??= createDriveClient(googleAccessToken);
  return client;
}


export const remotes = new Map<string, GoogleDriveStorageAdapter>();

/**
 * The chat's folder in Drive, for reading back photos the phone no longer keeps. One adapter
 * per chat for the life of the app, so its listing cache makes repeat lookups free.
 */
export async function remoteFor(archiveId: string): Promise<GoogleDriveStorageAdapter> {
  const known = remotes.get(archiveId);
  if (known !== undefined) return known;
  const adapter = new GoogleDriveStorageAdapter({
    client: driveClient(),
    rootFolderId: await folderIdFor(archiveId),
  });
  remotes.set(archiveId, adapter);
  return adapter;
}

export async function folderIdFor(archiveId: string): Promise<string> {
  const { folderId } = await readBackupState(archiveId);
  if (folderId !== undefined) return folderId;
  const appFolder = await ensureAppFolder(driveClient());
  const found = (await listArchiveFolders(driveClient(), appFolder)).find((f) => f.archiveId === archiveId);
  if (found === undefined) throw new Error("This chat is not in your Google Drive.");
  return found.folderId;
}
