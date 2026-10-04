/** Free local content only after a complete remote copy has been verified.
 * Metadata is checked byte-for-byte; large media uses Drive's size after successful upload.
 * A tiny header remains so local staging and protected key handling can identify the archive.
 */
import { HEADER_PATH } from "@chatvault/core";
import type { StorageAdapter } from "@chatvault/storage";
export async function offloadArchiveContent(
  local: StorageAdapter,
  remote: StorageAdapter,
  sha256Hex: (bytes: Uint8Array) => Promise<string>,
  markCloudOnly: () => Promise<void>,
  assertSession: () => void,
): Promise<void> {
  const paths = await local.list("");
  for (const path of paths) {
    assertSession();
    if (!(await remote.has(path))) throw new Error(`Backup is incomplete: ${path}`);
    if (path.startsWith("media/")) {
      const ours = await local.sizeOf?.(path);
      const theirs = await remote.sizeOf?.(path);
      if (ours === undefined || theirs !== ours) throw new Error(`Backup size differs: ${path}`);
    } else if (await sha256Hex(await local.get(path)) !== await sha256Hex(await remote.get(path))) {
      throw new Error(`Backup content differs: ${path}`);
    }
  }
  assertSession();
  // Persist the read source before deleting: interrupted cleanup remains readable from Drive.
  await markCloudOnly();
  for (const path of paths) { if (path === HEADER_PATH) continue; assertSession(); await local.remove(path); }
}
