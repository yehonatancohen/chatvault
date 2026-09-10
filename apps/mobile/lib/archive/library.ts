/**
 * A7 — what the library screen lists.
 *
 * Reading the list means opening every archive, because everything worth showing about one —
 * its chat title, its message count, its date range — is inside the sealed manifest. Only the
 * format version and the KDF parameters are in the clear, which is the design working as
 * intended (`ArchiveHeader`: the header is allowed to leak that an archive exists, and nothing
 * about the chat).
 *
 * So an archive whose key is not in the keychain shows as **locked** rather than being hidden
 * or guessed at. That is a real state — a restored backup, a reinstall, an archive copied from
 * another device — and the way out of it is the passphrase, which is the path that always
 * works.
 */

import { ArchiveReader, type Manifest } from "@chatvault/core";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { listArchiveIds, loadArchiveKey, storageFor } from "./vault";

export interface LibraryEntry {
  readonly archiveId: string;
  readonly status: "ready" | "locked" | "unreadable";
  readonly manifest?: Manifest;
  /** Set when `status` is `"unreadable"`: what went wrong, shown as-is. */
  readonly problem?: string;
}

export async function readLibrary(): Promise<readonly LibraryEntry[]> {
  const entries: LibraryEntry[] = [];

  for (const archiveId of listArchiveIds()) {
    const key = await loadArchiveKey(archiveId);
    if (key === null) {
      entries.push({ archiveId, status: "locked" });
      continue;
    }

    try {
      const reader = await ArchiveReader.open({
        crypto: getCryptoProvider(),
        storage: storageFor(archiveId),
        key,
        archiveId,
      });
      entries.push({ archiveId, status: "ready", manifest: reader.manifest });
    } catch (error) {
      // A failure here is worth showing, not swallowing: it is the difference between "your
      // archive is fine" and "your archive does not open", and the user is about to decide
      // whether to delete a chat on the strength of it.
      entries.push({
        archiveId,
        status: "unreadable",
        problem: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Most recently updated first: the archive someone just imported into is the one they want.
  return entries.sort((a, b) => (b.manifest?.updatedAt ?? 0) - (a.manifest?.updatedAt ?? 0));
}
