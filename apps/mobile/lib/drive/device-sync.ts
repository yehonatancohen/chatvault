/**
 * Backing archives up to the user's Google Drive, and restoring them onto a new phone.
 *
 * The logic is `pushArchive` / `pullArchive` in `@chatvault/storage`, tested in CI against
 * real archives over `FakeDrive`. This file only supplies the device's halves — the filesystem
 * adapter, the Drive client with the signed-in account's token, the native SHA-256 — and keeps
 * one run per archive at a time, observable from any screen.
 *
 * **It never decrypts.** Drive gets exactly the files the phone has — plain, or sealed for a
 * protected chat (which, restored, shows locked until its passphrase is entered).
 *
 * **Photos don't stay on the phone.** After a backup, every photo Drive verifiably holds is
 * removed locally (`offloadMedia`); messages stay. Restores bring back messages only. Screens
 * read photos through `readableStorageFor` (`lib/archive/readable-storage.ts`), which falls back
 * to Drive for anything the phone no longer has.
 *
 * Nothing here talks to Boydem's servers (root `CLAUDE.md`, invariant 2).
 */

import { Directory } from "expo-file-system";
import { ArchiveReader, toHex } from "@chatvault/core";
import {
  ensureAppFolder,
  GoogleDriveStorageAdapter,
  listArchiveFolders,
  offloadMedia,
  pullArchive,
  pushArchive,
  type SyncProgress,
} from "@chatvault/storage";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { ExpoFileSystemStorageAdapter } from "../storage/expo-file-system-adapter";
import { archivesRoot, keyForArchive, listArchiveIds, storageFor } from "../archive/vault";
import { translate } from "../i18n/translate";
import { readSettingsSync } from "../settings/settings";
import { readBackupState, writeBackupState } from "./backup-state";
import { createDriveClient, driveFolderUrl, driveStorageFor } from "./drive-storage";
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
      const { storage: remote, folderId } = await driveStorageFor(
        driveClient(),
        archiveId,
        await folderNameFor(archiveId),
      );
      remotes.set(archiveId, remote);
      const result = await pushArchive(storageFor(archiveId), remote, state.ledger, {
        sha256Hex,
        // Saved as it goes, so a backup cut off by the app being closed resumes where it was.
        onLedger: async (ledger) => writeBackupState(archiveId, { ...state, ledger }),
        onProgress: (progress) => publish(archiveId, { kind: "running", progress }),
      });
      if (result.kind === "diverged") return { kind: "diverged" };

      const backedUpAt = Date.now();
      writeBackupState(archiveId, { ledger: result.ledger, backedUpAt, folderId });
      // The point of the product: now that Drive holds the photos, the phone does not keep them.
      // Only files Drive reports at the same size are removed; messages stay on the phone.
      try {
        await offloadMedia(storageFor(archiveId), remote);
      } catch {
        // The backup itself succeeded; freeing space is retried when the chat list next opens.
      }
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
        const { backedUpAt, folderId } = await readBackupState(chat.archiveId);
        const behind = backedUpAt === undefined || backedUpAt < chat.updatedAt;
        // Also re-run for a chat that is current but was backed up before folders were named
        // after chats (no folder recorded), or still has photos on the phone (an offload that
        // failed or predates offloading). With nothing to upload, that costs one listing.
        const unfinished =
          folderId === undefined || (await storageFor(chat.archiveId).list("media/")).length > 0;
        if (behind || unfinished) await backupArchive(chat.archiveId);
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
  const folderId = await folderIdFor(archiveId);
  const remote = new GoogleDriveStorageAdapter({ client: driveClient(), rootFolderId: folderId });
  const local = new ExpoFileSystemStorageAdapter(new Directory(archivesRoot(), archiveId));
  // Messages only: photos stay in Drive and are fetched when looked at, so moving to a new
  // phone does not fill it up again.
  const ledger = await pullArchive(remote, local, {
    sha256Hex,
    skipMedia: true,
    ...(onProgress !== undefined ? { onProgress } : {}),
  });
  writeBackupState(archiveId, { ledger, backedUpAt: Date.now(), folderId });
}

/** The chat's folder in Drive, as a link, once it has been backed up. */
export async function driveLinkFor(archiveId: string): Promise<string | undefined> {
  const { folderId } = await readBackupState(archiveId);
  return folderId !== undefined ? driveFolderUrl(folderId) : undefined;
}

const remotes = new Map<string, GoogleDriveStorageAdapter>();

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

async function folderIdFor(archiveId: string): Promise<string> {
  const { folderId } = await readBackupState(archiveId);
  if (folderId !== undefined) return folderId;
  const appFolder = await ensureAppFolder(driveClient());
  const found = (await listArchiveFolders(driveClient(), appFolder)).find((f) => f.archiveId === archiveId);
  if (found === undefined) throw new Error("This chat is not in your Google Drive.");
  return found.folderId;
}

/**
 * What the chat's Drive folder is called: its title for a plain chat, so the user's Drive reads
 * like their chat list. A protected chat's title is sealed, so its folder gets a neutral name —
 * a folder name is visible to anyone the folder is ever shared with.
 */
async function folderNameFor(archiveId: string): Promise<string> {
  const fallback = translate(readSettingsSync().language, "drive.protectedFolder");
  try {
    const key = await keyForArchive(archiveId);
    if (key !== undefined) return fallback;
    const reader = await ArchiveReader.open({ crypto: getCryptoProvider(), storage: storageFor(archiveId), archiveId });
    return reader.manifest.chatTitle.trim() || fallback;
  } catch {
    return fallback;
  }
}
