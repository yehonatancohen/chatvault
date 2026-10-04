/** Local imports are durable staging; successful backups leave their content in Drive. */
import { Directory, Paths } from "expo-file-system";
import { ArchiveReader, toHex } from "@chatvault/core";
import { pushArchive, type SyncProgress } from "@chatvault/storage";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { ExpoFileSystemStorageAdapter } from "../storage/expo-file-system-adapter";
import { stageRemoteArchive } from "./stage";
import { newArchiveId, storageFor } from "../archive/vault";
import { pendingArchiveIds, visibleArchiveIds } from "../archive/catalog";
import { withArchiveOperation } from "../archive/operation";
import { translate } from "../i18n/translate";
import { readSettingsSync } from "../settings/settings";
import { readBackupState, writeBackupState } from "./backup-state";
import { driveFolderUrl, driveStorageFor } from "./drive-storage";
import { restoreGoogleConnection } from "./google-auth";
import { driveClient, folderIdFor, remoteFor, remotes } from "./drive-client";
import { accountEmail, assertDriveSession, sessionGeneration, subscribeDriveSession } from "./session";
import { offloadArchiveContent } from "./offload";

export type BackupStatus =
  | { readonly kind: "idle"; readonly backedUpAt?: number }
  | { readonly kind: "running"; readonly progress?: SyncProgress }
  | { readonly kind: "done"; readonly backedUpAt: number }
  | { readonly kind: "diverged" }
  | { readonly kind: "failed"; readonly message: string };
type Listener = (status: BackupStatus) => void;
const running = new Map<string, Promise<BackupStatus>>();
const latest = new Map<string, BackupStatus>();
const listeners = new Map<string, Set<Listener>>();
subscribeDriveSession(() => {
  latest.clear();
  for (const set of listeners.values()) for (const listener of set) listener({ kind: "idle" });
});
const sha256Hex = async (bytes: Uint8Array): Promise<string> => toHex(await getCryptoProvider().sha256(bytes));
export async function isDriveConnected(): Promise<boolean> {
  try { return (await restoreGoogleConnection())?.hasDrive === true; } catch { return false; }
}
export function watchBackup(id: string, listener: Listener): () => void {
  const set = listeners.get(id) ?? new Set<Listener>();
  set.add(listener); listeners.set(id, set);
  const generation = sessionGeneration();
  listener(latest.get(id) ?? { kind: "idle" });
  void readBackupState(id).then(state => {
    if (generation !== sessionGeneration() || latest.has(id) || !set.has(listener)) return;
    if (state.accountEmail === accountEmail() && state.backedUpAt !== undefined) listener({ kind: "idle", backedUpAt: state.backedUpAt });
  });
  return () => { set.delete(listener); };
}
function publish(id: string, status: BackupStatus): void {
  latest.set(id, status);
  for (const listener of listeners.get(id) ?? []) listener(status);
}
export function backupArchive(id: string): Promise<BackupStatus> {
  const existing = running.get(id);
  if (existing) return existing;
  let generation: number | undefined;
  const run = withArchiveOperation(id, async (): Promise<BackupStatus> => {
    try {
      if (!(await isDriveConnected())) throw new Error("Connect Google Drive to back up this chat.");
      generation = sessionGeneration();
      const email = accountEmail()!;
      const state = await readBackupState(id);
      if (state.accountEmail && state.accountEmail !== email) throw new Error("Reconnect the account that owns this chat.");
      if (!state.accountEmail && state.backedUpAt) throw new Error("Refresh this account's Drive chats before backing up a legacy archive.");
      if (state.cloudOnly) {
        // Retry interrupted cleanup without re-uploading a header-only local stub.
        await offloadArchiveContent(storageFor(id), await remoteFor(id), sha256Hex, async () => {}, () => assertDriveSession(generation!));
        return { kind: "done", backedUpAt: state.backedUpAt ?? Date.now() };
      }
      publish(id, { kind: "running" });
      const owned = { ...state, accountEmail: email };
      assertDriveSession(generation);
      writeBackupState(id, owned);
      const { storage: remote, folderId } = await driveStorageFor(driveClient(), id, await folderNameFor(id));
      assertDriveSession(generation);
      remotes.set(id, remote);
      let lastPublished = 0;
      const result = await pushArchive(storageFor(id), remote, state.ledger, {
        sha256Hex,
        onLedger: async ledger => { assertDriveSession(generation!); writeBackupState(id, { ...owned, ledger, folderId }); },
        onProgress: progress => {
          if (generation !== sessionGeneration()) return;
          const now = Date.now();
          if (now - lastPublished < 250 && progress.done !== progress.total) return;
          lastPublished = now; publish(id, { kind: "running", progress });
        },
      });
      assertDriveSession(generation);
      if (result.kind === "diverged") return { kind: "diverged" };
      const backedUpAt = Date.now();
      const complete = { ...owned, ledger: result.ledger, backedUpAt, folderId };
      // Failed verification or cleanup keeps the staging data and can be retried safely.
      await offloadArchiveContent(storageFor(id), remote, sha256Hex,
        async () => { writeBackupState(id, { ...complete, cloudOnly: true }); },
        () => assertDriveSession(generation!));
      return { kind: "done", backedUpAt };
    } catch (error) { return { kind: "failed", message: error instanceof Error ? error.message : String(error) }; }
  });
  running.set(id, run);
  void run.then(status => {
    running.delete(id);
    if (generation === sessionGeneration()) publish(id, status);
  });
  return run;
}
let pendingRun: Promise<void> | undefined;
export function backupPending(chats: readonly { readonly archiveId: string; readonly updatedAt: number }[]): Promise<void> {
  pendingRun ??= (async () => {
    if (!(await isDriveConnected())) return;
    const generation = sessionGeneration();
    for (const chat of chats) {
      if (generation !== sessionGeneration()) return;
      const state = await readBackupState(chat.archiveId);
      if (state.accountEmail !== accountEmail() && (state.accountEmail || state.backedUpAt)) continue;
      // Remote-only entries have no local directory. Header stubs may need interrupted cleanup.
      const content = (await storageFor(chat.archiveId).list("")).some(path => path !== "header.json");
      if (!state.cloudOnly || content) await backupArchive(chat.archiveId);
    }
  })().finally(() => { pendingRun = undefined; });
  return pendingRun;
}
export async function backupAll(): Promise<{ ok: number; failed: number }> {
  await visibleArchiveIds();
  let ok = 0, failed = 0;
  for (const id of await pendingArchiveIds()) {
    const status = await backupArchive(id);
    if (status.kind === "done") ok += 1; else failed += 1;
  }
  return { ok, failed };
}
/** Temporary messages for an append; media stays in Drive and is read only if needed. */
export async function stageArchiveForImport(id: string): Promise<void> {
  const state = await readBackupState(id);
  if ((state.accountEmail && state.accountEmail !== accountEmail()) || (!state.accountEmail && state.backedUpAt)) throw new Error("Finish backing up this chat in its original Google account before appending from another account.");
  if (!state.cloudOnly) return;
  const generation = sessionGeneration();
  if (state.accountEmail !== accountEmail()) throw new Error("Reconnect the account that owns this chat.");
  const remote = await remoteFor(id);
  const directory = new Directory(Paths.cache, "drive-staging", newArchiveId());
  try {
    const ledger = await stageRemoteArchive(storageFor(id), remote, new ExpoFileSystemStorageAdapter(directory), sha256Hex, () => assertDriveSession(generation));
    assertDriveSession(generation);
    writeBackupState(id, { ...state, ledger, cloudOnly: false });
  } finally {
    // An isolated, generated cache directory; no archive or shared export lives here.
    if (directory.exists) directory.delete();
  }
}
export async function driveLinkFor(id: string): Promise<string | undefined> {
  if (!(await isDriveConnected())) return undefined;
  return driveFolderUrl(await folderIdFor(id));
}
async function folderNameFor(id: string): Promise<string> {
  const fallback = translate(readSettingsSync().language, "drive.protectedFolder");
  try {
    // Do not decrypt a title into a public folder name for protected chats.
    const reader = await ArchiveReader.open({ crypto: getCryptoProvider(), storage: storageFor(id), archiveId: id });
    return reader.manifest.chatTitle.trim() || fallback;
  } catch { return fallback; }
}
