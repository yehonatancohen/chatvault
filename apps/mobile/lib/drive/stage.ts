import { HEADER_PATH } from "@chatvault/core";
import { pullArchive, type StorageAdapter, type SyncLedger } from "@chatvault/storage";
/** Download into a fresh temporary destination; leave the existing stub intact on failure. */
export async function stageRemoteArchive(
  local: StorageAdapter, remote: StorageAdapter, temporary: StorageAdapter,
  sha256Hex: (bytes: Uint8Array) => Promise<string>, assertSession: () => void,
): Promise<SyncLedger> {
  const ledger = await pullArchive(remote, temporary, { sha256Hex, skipMedia: true });
  assertSession();
  const paths = (await temporary.list("")).filter(path => path !== HEADER_PATH);
  for (const path of [...paths, HEADER_PATH]) {
    const bytes = await temporary.get(path);
    assertSession();
    await local.put(path, bytes);
  }
  assertSession();
  return ledger;
}
