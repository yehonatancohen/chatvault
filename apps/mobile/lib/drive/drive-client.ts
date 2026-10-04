/** Clients and folder caches belong to one Google session, never to the whole app. */
import { ensureAppFolder, GoogleDriveStorageAdapter, listArchiveFolders } from "@chatvault/storage";
import { createDriveClient } from "./drive-storage";
import { googleAccessToken } from "./google-auth";
import { assertDriveSession, sessionGeneration, subscribeDriveSession } from "./session";

let client: ReturnType<typeof createDriveClient> | undefined;
export const remotes = new Map<string, GoogleDriveStorageAdapter>();
subscribeDriveSession(() => { client = undefined; remotes.clear(); });
export function driveClient() {
  const generation = sessionGeneration();
  assertDriveSession(generation);
  client ??= createDriveClient(async (options) => {
    assertDriveSession(generation);
    const token = await googleAccessToken(options);
    assertDriveSession(generation);
    return token;
  });
  return client;
}
export async function remoteFor(archiveId: string): Promise<GoogleDriveStorageAdapter> {
  const generation = sessionGeneration();
  assertDriveSession(generation);
  const known = remotes.get(archiveId);
  if (known) return known;
  const adapter = new GoogleDriveStorageAdapter({ client: driveClient(), rootFolderId: await folderIdFor(archiveId) });
  assertDriveSession(generation);
  remotes.set(archiveId, adapter);
  return adapter;
}
export async function folderIdFor(archiveId: string): Promise<string> {
  // Never use an old device-global folder ID with a different account's token.
  const generation = sessionGeneration();
  const currentClient = driveClient();
  const appFolder = await ensureAppFolder(currentClient);
  const found = (await listArchiveFolders(currentClient, appFolder)).find(f => f.archiveId === archiveId);
  assertDriveSession(generation);
  if (!found) throw new Error("This chat is not in your Google Drive.");
  return found.folderId;
}
