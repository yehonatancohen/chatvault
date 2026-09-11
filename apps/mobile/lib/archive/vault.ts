/**
 * The device's archives: where they live, and where their keys live.
 *
 * Two separate stores, on purpose:
 *
 * - **The archive** is a directory under the app's document directory, one per archive, holding
 *   exactly what `ArchiveStoragePort` holds. `ExpoFileSystemStorageAdapter` rooted there *is*
 *   the port. Documents rather than cache, because the system reaps the cache directory when
 *   the device runs low on space — which is precisely the situation this app's users are in.
 * - **The key** is in `expo-secure-store` (Keychain / Keystore), never on the filesystem beside
 *   the ciphertext it opens. It is a convenience only: the archive's real door is the
 *   passphrase, wrapped into the cleartext header (`lib/crypto/key-wrapping.ts`). A key that
 *   exists only in the keychain dies with the phone, and `apps/mobile/CLAUDE.md` requires the
 *   passphrase path to keep working for exactly that reason.
 *
 * This file is deliberately thin. Everything with logic worth testing lives in `lib/import`
 * and `lib/crypto`, which run under Node; what is here can only be exercised on a device.
 */

import { Directory, File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { HEADER_PATH, isPlainHeader, readHeader, type ArchiveHeader } from "@chatvault/core";
import { ExpoFileSystemStorageAdapter } from "../storage/expo-file-system-adapter";
import { fromBase64, toBase64 } from "../crypto/base64";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { unwrapArchiveKey } from "../crypto/key-wrapping";
import { deletePreferences } from "./preferences";
import { deleteBackupState } from "../drive/backup-state";

const ARCHIVES_DIRECTORY = "archives";
const KEY_PREFIX = "chatvault.archiveKey.";

export function archivesRoot(): Directory {
  return new Directory(Paths.document, ARCHIVES_DIRECTORY);
}

export function newArchiveId(): string {
  return Crypto.randomUUID();
}

export function storageFor(archiveId: string): ExpoFileSystemStorageAdapter {
  return new ExpoFileSystemStorageAdapter(new Directory(archivesRoot(), archiveId));
}

/**
 * Archive ids on this device, newest first is *not* guaranteed — the order is the filesystem's.
 * Callers that care sort by the manifest's `updatedAt`; matching (`chooseTarget`) needs only
 * that the order be stable within a run, which it is.
 */
export function listArchiveIds(): string[] {
  const root = archivesRoot();
  if (!root.exists) return [];
  return root
    .list()
    .filter((entry): entry is Directory => entry instanceof Directory)
    // A directory with no header is a half-written archive from an interrupted first import.
    // Listing it would put an unopenable row in the library; it is skipped, not deleted —
    // nothing in this app deletes a user's data without them asking.
    .filter((entry) => new File(entry, HEADER_PATH).exists)
    .map((entry) => entry.name);
}

/** The cleartext header: format version, id, createdAt, KDF params. Never anything about the chat. */
export async function readArchiveHeader(archiveId: string): Promise<ArchiveHeader> {
  return readHeader(storageFor(archiveId), archiveId);
}

export async function saveArchiveKey(archiveId: string, key: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(KEY_PREFIX + archiveId, toBase64(key), {
    // The archive is readable whenever the app is, but the key never leaves this device in an
    // iCloud Keychain sync or an unencrypted backup.
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * The archive key, if this device still holds it.
 *
 * `null` is a normal state, not an error: a restored backup, a reinstall, or an archive
 * someone else created all reach here without a key. The caller's job is then to ask for the
 * passphrase — which is the path that always works — rather than to treat the archive as lost.
 */
export async function loadArchiveKey(archiveId: string): Promise<Uint8Array | null> {
  const stored = await SecureStore.getItemAsync(KEY_PREFIX + archiveId);
  if (stored === null) return null;
  try {
    return fromBase64(stored);
  } catch {
    return null;
  }
}

/**
 * Remove an archive from this phone, permanently.
 *
 * The only destructive operation in the app, so the order matters and is not arbitrary:
 *
 * 1. **The directory first.** While it exists the archive is still openable, so a failure at
 *    any later step leaves the user with a working archive rather than a folder of ciphertext
 *    whose key has been thrown away. The reverse order can destroy data on a partial failure.
 * 2. **Then the key**, which is worthless on its own once the ciphertext is gone, and would
 *    otherwise sit in the Keychain forever after a reinstall.
 * 3. **Then the display preferences**, which are disposable by definition.
 *
 * Steps 2 and 3 are best-effort for the same reason: once step 1 has succeeded the archive is
 * gone from the user's point of view, and failing the whole operation over an orphaned Keychain
 * entry would report a removal that plainly did happen as an error.
 *
 * Nothing here touches WhatsApp — there is nothing in WhatsApp to touch (root CLAUDE.md,
 * invariant 1). Removing an archive removes our copy and only our copy, which is exactly why
 * the confirmation in front of it is worded the way it is.
 */
export async function deleteArchive(archiveId: string): Promise<void> {
  const directory = new Directory(archivesRoot(), archiveId);
  if (directory.exists) directory.delete();

  try {
    await SecureStore.deleteItemAsync(KEY_PREFIX + archiveId);
  } catch {
    // A key with no ciphertext behind it opens nothing.
  }

  try {
    await deletePreferences(archiveId);
  } catch {
    // Cosmetic; see `lib/archive/preferences.ts`.
  }

  try {
    // This phone's record of what it backed up. The copy in the user's Drive is theirs and is
    // not touched — removing from this phone means this phone.
    deleteBackupState(archiveId);
  } catch {
    // Disposable by design; see `lib/drive/backup-state.ts`.
  }
}

/** Whether this archive was saved with a passphrase. Most are not — encryption is opt-in. */
export async function isArchiveProtected(archiveId: string): Promise<boolean> {
  return !isPlainHeader(await readArchiveHeader(archiveId));
}

/**
 * The key to open an archive with: `undefined` for a plain one (none needed), the Keychain's
 * copy for a protected one, or `null` when a protected archive's key is not on this phone —
 * the "locked" state, opened by its passphrase.
 */
export async function keyForArchive(archiveId: string): Promise<Uint8Array | undefined | null> {
  if (!(await isArchiveProtected(archiveId))) return undefined;
  return loadArchiveKey(archiveId);
}

/** Re-derive the key from the passphrase and put it back in the keychain. */
export async function unlockWithPassphrase(
  archiveId: string,
  passphrase: string,
): Promise<Uint8Array> {
  const header = await readArchiveHeader(archiveId);
  if (isPlainHeader(header)) throw new Error("This chat has no passphrase.");
  const key = await unwrapArchiveKey(header.keyWrapping, passphrase, getCryptoProvider());
  await saveArchiveKey(archiveId, key);
  return key;
}
