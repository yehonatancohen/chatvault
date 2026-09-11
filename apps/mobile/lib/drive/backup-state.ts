/**
 * What this device last backed up to Google Drive, per archive. Device-local, disposable.
 *
 * Holds the sync ledger (`@chatvault/storage` → `SyncLedger`: path → hash of the ciphertext last
 * sent) and when the last backup finished. Losing it costs one full comparison on the next
 * backup, never data: `pushArchive` adopts a Drive copy that matches, and refuses one that
 * doesn't.
 *
 * Like `preferences.ts`, deliberately outside the archive directory — it describes this
 * device's relationship to one destination, not the archive.
 */

import { Directory, File, Paths } from "expo-file-system";
import type { SyncLedger } from "@chatvault/storage";

export interface BackupState {
  readonly ledger: SyncLedger;
  /** Epoch ms of the last *completed* backup. Absent while only partially backed up. */
  readonly backedUpAt?: number;
  /** The chat's folder in Drive, for "open in Drive" and for reading media back. */
  readonly folderId?: string;
}

const DIRECTORY = "drive-backup";

function fileFor(archiveId: string): File {
  return new File(new Directory(Paths.document, DIRECTORY), `${archiveId}.json`);
}

export async function readBackupState(archiveId: string): Promise<BackupState> {
  const file = fileFor(archiveId);
  if (!file.exists) return { ledger: {} };
  try {
    const parsed = JSON.parse(await file.text()) as Partial<BackupState>;
    return {
      ledger: typeof parsed.ledger === "object" && parsed.ledger !== null ? parsed.ledger : {},
      ...(typeof parsed.backedUpAt === "number" ? { backedUpAt: parsed.backedUpAt } : {}),
      ...(typeof parsed.folderId === "string" ? { folderId: parsed.folderId } : {}),
    };
  } catch {
    return { ledger: {} };
  }
}

export function writeBackupState(archiveId: string, state: BackupState): void {
  const file = fileFor(archiveId);
  file.parentDirectory.create({ intermediates: true, idempotent: true });
  file.write(JSON.stringify(state));
}

/** Forget it when the archive leaves this phone. The copy in Drive is the user's and stays. */
export function deleteBackupState(archiveId: string): void {
  const file = fileFor(archiveId);
  if (file.exists) file.delete();
}
