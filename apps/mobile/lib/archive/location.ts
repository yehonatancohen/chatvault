/** Reading location can differ from a preserved staging copy belonging to another account. */
import { readBackupState, type BackupState } from "../drive/backup-state";
import { remotes } from "../drive/drive-client";
import { accountEmail } from "../drive/session";
export async function readViewBackupState(id: string): Promise<BackupState> {
  const state = await readBackupState(id);
  const email = accountEmail();
  if (email && remotes.has(id) && (state.accountEmail !== email && (state.accountEmail || state.backedUpAt))) {
    // A shared archive may have the same ID in two Google accounts. Read this account's copy,
    // without claiming or overwriting the other account's unfinished local work.
    return { ledger: {}, accountEmail: email, cloudOnly: true, backedUpAt: Date.now() };
  }
  return state;
}
