/** Discovery combines this account's Drive folders with its unfinished local imports. */
import { HEADER_PATH, PLAIN_MANIFEST_PATH, MANIFEST_PATH, toHex } from "@chatvault/core";
import { ensureAppFolder, listArchiveFolders, GoogleDriveStorageAdapter } from "@chatvault/storage";
import { driveClient, remotes } from "../drive/drive-client";
import { restoreGoogleConnection } from "../drive/google-auth";
import { accountEmail, sessionGeneration } from "../drive/session";
import { readBackupState, writeBackupState } from "../drive/backup-state";
import { withArchiveOperation } from "./operation";
import { listArchiveIds } from "./vault";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";

export async function pendingArchiveIds(): Promise<string[]> {
  const email = accountEmail();
  const ids: string[] = [];
  for (const id of listArchiveIds()) {
    const state = await readBackupState(id);
    if (state.cloudOnly) continue;
    if (state.accountEmail && state.accountEmail !== email) continue;
    if (!state.accountEmail && state.backedUpAt) continue; // legacy ownership is not known yet
    ids.push(id);
  }
  return ids;
}

export async function visibleArchiveIds(): Promise<string[]> {
  await restoreGoogleConnection();
  const generation = sessionGeneration();
  const email = accountEmail();
  const ids = new Set(await pendingArchiveIds());
  if (!email) return [...ids];
  const client = driveClient();
  const root = await ensureAppFolder(client);
  for (const folder of await listArchiveFolders(client, root)) {
    if (generation !== sessionGeneration()) return [];
    const remote = new GoogleDriveStorageAdapter({ client, rootFolderId: folder.folderId });
    if (!(await remote.has(HEADER_PATH))) continue;
    const manifestPath = await remote.has(PLAIN_MANIFEST_PATH) ? PLAIN_MANIFEST_PATH : MANIFEST_PATH;
    if (!(await remote.has(manifestPath))) continue; // an interrupted initial upload is not readable
    const visible = await withArchiveOperation(folder.archiveId, async () => {
      const state = await readBackupState(folder.archiveId);
      if (state.accountEmail && state.accountEmail !== email) {
        if (generation !== sessionGeneration()) return false;
        remotes.set(folder.archiveId, remote);
        return true;
      }
      if (generation !== sessionGeneration()) return false;
      // Legacy ownership is adopted only when the last uploaded manifest matches this account.
      let ownedLegacy = false;
      if (!state.accountEmail && state.backedUpAt) {
        const hash = toHex(await getCryptoProvider().sha256(await remote.get(manifestPath)));
        ownedLegacy = state.ledger[manifestPath] === hash;
        if (!ownedLegacy) {
          if (generation !== sessionGeneration()) return false;
          remotes.set(folder.archiveId, remote);
          return true;
        }
      }
      if (generation !== sessionGeneration()) return false;
      remotes.set(folder.archiveId, remote);
      if (!state.accountEmail) {
        writeBackupState(folder.archiveId, {
          ...state, accountEmail: email, folderId: folder.folderId,
          ...(!ids.has(folder.archiveId) && !ownedLegacy ? { cloudOnly: true, backedUpAt: Date.now() } : {}),
        });
      }
      return true;
    });
    if (!visible) continue;
    ids.add(folder.archiveId);
  }
  return generation === sessionGeneration() ? [...ids] : [];
}
