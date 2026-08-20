/**
 * The bundle-open flow (B0a): file in, unlocked `ArchiveReader` out.
 *
 * Deliberately a plain async function rather than a hook — it has one job, it either succeeds
 * or throws one of the errors below, and callers already need their own state machine for
 * "picking a file" vs "unlocking" vs "viewing".
 */

import { ArchiveReader, createWebCryptoProvider, readHeader } from "@chatvault/core";
import { BundleStorage } from "./bundle-storage";
import { unwrapArchiveKey } from "./unwrap-key";

export interface OpenedArchive {
  readonly storage: BundleStorage;
  readonly reader: ArchiveReader;
  /**
   * The raw archive key, kept alongside the reader. `ArchiveReader` deliberately does not
   * expose it (it is a private field) — but appending needs to construct a fresh
   * `ArchiveWriter` and reopen a reader afterwards, and re-prompting for the passphrase on
   * every append would be a needless second unlock for something already unlocked this
   * session. Never sent anywhere; lives only in this tab's memory.
   */
  readonly key: Uint8Array;
}

export async function openBundle(file: File, passphrase: string): Promise<OpenedArchive> {
  const storage = await BundleStorage.open(file);
  const crypto = createWebCryptoProvider(window.crypto.subtle, (a) => window.crypto.getRandomValues(a));

  const header = await readHeader(storage, await archiveIdOf(storage));
  const key = await unwrapArchiveKey(header, passphrase, crypto);
  const reader = await ArchiveReader.open({
    crypto,
    storage,
    key,
    archiveId: header.archiveId,
  });

  return { storage, reader, key };
}

/**
 * `readHeader` checks the id it is given against the one in the file, so the first read has
 * to come from the file itself rather than from a caller who might not know it yet — exactly
 * the bundle-open case, where there is no URL carrying an archive id.
 */
async function archiveIdOf(storage: BundleStorage): Promise<string> {
  const raw = await storage.get("header.json");
  const parsed = JSON.parse(new TextDecoder().decode(raw)) as { archiveId?: unknown };
  if (typeof parsed.archiveId !== "string") {
    throw new Error("This file does not look like a .cvault bundle.");
  }
  return parsed.archiveId;
}
