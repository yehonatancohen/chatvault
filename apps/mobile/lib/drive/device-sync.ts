/**
 * Backing archives up to the user's Google Drive, and restoring them onto a new phone.
 *
 * The logic is `pushArchive` / `pullArchive` in `@chatvault/storage`, tested in CI against
 * real archives over `FakeDrive`. This file only supplies the device's halves — the filesystem
 * adapter, the Drive client with the signed-in account's token, the native SHA-256 — and keeps
 * one run per archive at a time, observable from any screen.
 *
 * **It never decrypts.** An archive in Drive is the same sealed files as on the phone; a restored
 * archive shows as locked in the library until its passphrase is entered, through the path that
 * already exists for a restored backup (`vault.ts` → `unlockWithPassphrase`).
 *
 * Nothing here talks to Boydem's servers (root `CLAUDE.md`, invariant 2).
 */

import { Directory } from "expo-file-system";
import { toHex } from "@chatvault/core";
import {
  ensureAppFolder,
  listArchiveFolders,
  pullArchive,
  pushArchive,
  type SyncProgress,
} from "@chatvault/storage";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { ExpoFileSystemStorageAdapter } from "../storage/expo-file-system-adapter";
import { archivesRoot, listArchiveIds, storageFor } from "../archive/vault";
import { readBackupState, writeBackupState } from "./backup-state";
import { createDriveClient, driveStorageFor } from "./drive-storage";
import { googleAccessToken, restoreGoogleConnection } from "./google-auth";

export type BackupStatus =
  | { readonly kind: "idle"; readonly backedUpAt?: number }
  | { readonly kind: "running"; readonly progress?: SyncProgress }
  | { readonly kind: "done"; readonly backedUpAt: number }
  /** Another device changed the Drive copy since this phone last backed it up. */
  | { readonly kind: "diverged" }
  | { readonly kind: "failed"; readonly message: string };

type Listener = (status: BackupStatus) => void;

const running = new Map<string, Promise<BackupStatus>>();
const latest = new Map<string, BackupStatus>();
const listeners = new Map<string, Set<Listener>>();

const sha256Hex = async (bytes: Uint8Array): Promise<string> =>
  toHex(await getCryptoProvider().sha256(bytes));

let client: ReturnType<typeof createDriveClient> | undefined;
function driveClient() {
  client ??= createDriveClient(googleAccessToken);
  return client;
}

/** Whether a Google account with Drive access is connected on this phone. */
export async function isDriveConnected(): Promise<boolean> {
  try {
    const connection = await restoreGoogleConnection();
    return connection?.hasDrive === true;
  } catch {
    return false;
  }
}

/** The current status, then every change until unsubscribed. */
export function watchBackup(archiveId: string, listener: Listener): () => void {
  const set = listeners.get(archiveId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(archiveId, set);

  const known = latest.get(archiveId);
  if (known !== undefined) {
    listener(known);
  } else {
    void readBackupState(archiveId).then((state) => {
      if (!latest.has(archiveId)) {
        listener(state.backedUpAt !== undefined ? { kind: "idle", backedUpAt: state.backedUpAt } : { kind: "idle" });
      }
    });
  }
  return () => {
    set.delete(listener);
  };
}

function publish(archiveId: string, status: BackupStatus): void {
  latest.set(archiveId, status);
  for (const listener of listeners.get(archiveId) ?? []) listener(status);
}

/**
 * Back one archive up. Calling again while a backup of the same archive is running joins it
 * rather than starting a second one.
 */
export function backupArchive(archiveId: string): Promise<BackupStatus> {
  const inFlight = running.get(archiveId);
  if (inFlight !== undefined) return inFlight;

  const run = (async (): Promise<BackupStatus> => {
    publish(archiveId, { kind: "running" });
    try {
      const state = await readBackupState(archiveId);
      const remote = await driveStorageFor(driveClient(), archiveId);
      const result = await pushArchive(storageFor(archiveId), remote, state.ledger, {
        sha256Hex,
        // Saved as it goes, so a backup cut off by the app being closed resumes where it was.
        onLedger: async (ledger) => writeBackupState(archiveId, { ...state, ledger }),
        onProgress: (progress) => publish(archiveId, { kind: "running", progress }),
      });
      if (result.kind === "diverged") return { kind: "diverged" };

      const backedUpAt = Date.now();
      writeBackupState(archiveId, { ledger: result.ledger, backedUpAt });
      return { kind: "done", backedUpAt };
    } catch (error) {
      return { kind: "failed", message: error instanceof Error ? error.message : String(error) };
    }
  })();

  running.set(archiveId, run);
  void run.then((status) => {
    running.delete(archiveId);
    publish(archiveId, status);
  });
  return run;
}

let pendingRun: Promise<void> | undefined;

/**
 * Back up, one at a time, every chat whose latest version is not in Drive yet. Called when the
 * chat list opens, so statuses move from "On this phone" to "Safe to delete" without the user
 * pressing anything. A second call while one is running joins it.
 */
export function backupPending(
  chats: readonly { readonly archiveId: string; readonly updatedAt: number }[],
): Promise<void> {
  pendingRun ??= (async () => {
    try {
      if (!(await isDriveConnected())) return;
      for (const chat of chats) {
        const { backedUpAt } = await readBackupState(chat.archiveId);
        if (backedUpAt !== undefined && backedUpAt >= chat.updatedAt) continue;
        await backupArchive(chat.archiveId);
      }
    } finally {
      pendingRun = undefined;
    }
  })();
  return pendingRun;
}

/** Back up every archive on this phone, one after another. */
export async function backupAll(): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const archiveId of listArchiveIds()) {
    const status = await backupArchive(archiveId);
    if (status.kind === "done") ok += 1;
    else failed += 1;
  }
  return { ok, failed };
}

/** Archive ids in the user's Drive that are not on this phone — what a new phone can restore. */
export async function listRestorable(): Promise<string[]> {
  const appFolder = await ensureAppFolder(driveClient());
  const here = new Set(listArchiveIds());
  return (await listArchiveFolders(driveClient(), appFolder))
    .map((folder) => folder.archiveId)
    .filter((archiveId) => !here.has(archiveId));
}

/**
 * Copy one archive from Drive onto this phone. It appears in the library, locked, once its
 * header lands — which `pullArchive` writes last, so a cut-off restore never shows as a chat.
 */
export async function restoreArchive(
  archiveId: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<void> {
  const remote = await driveStorageFor(driveClient(), archiveId);
  const local = new ExpoFileSystemStorageAdapter(new Directory(archivesRoot(), archiveId));
  const ledger = await pullArchive(remote, local, {
    sha256Hex,
    ...(onProgress !== undefined ? { onProgress } : {}),
  });
  writeBackupState(archiveId, { ledger, backedUpAt: Date.now() });
}
