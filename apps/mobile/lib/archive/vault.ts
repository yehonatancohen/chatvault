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
import { HEADER_PATH, readHeader, type ArchiveHeader } from "@chatvault/core";
import { ExpoFileSystemStorageAdapter } from "../storage/expo-file-system-adapter";
import { fromBase64, toBase64 } from "../crypto/base64";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { unwrapArchiveKey } from "../crypto/key-wrapping";

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

/** Re-derive the key from the passphrase and put it back in the keychain. */
export async function unlockWithPassphrase(
  archiveId: string,
  passphrase: string,
): Promise<Uint8Array> {
  const header = await readArchiveHeader(archiveId);
  const key = await unwrapArchiveKey(header.keyWrapping, passphrase, getCryptoProvider());
  await saveArchiveKey(archiveId, key);
  return key;
}
