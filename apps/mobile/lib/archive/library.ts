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
import { buildMediaIndex, findChatPhoto, type MediaItem } from "../ui/media-index";
import { readPreferences } from "./preferences";
import { keyForArchive, listArchiveIds } from "./vault";
import { readableStorageFor } from "./readable-storage";
import { translate } from "../i18n/translate";
import type { Language } from "../settings/settings";

export interface LibraryEntry {
  readonly archiveId: string;
  readonly status: "ready" | "locked" | "unreadable";
  readonly manifest?: Manifest;
  /** Set when `status` is `"unreadable"`: what went wrong, shown as-is. */
  readonly problem?: string;
  /**
   * Kept so the row can decrypt its own thumbnail without opening the archive a second time.
   * In memory only, for as long as the list is on screen.
   */
  readonly reader?: ArchiveReader;
  /** The photo the user chose for this chat, if they have. Not yet decrypted. */
  readonly thumbnail?: MediaItem;
  /** The most recent message, for the one-line preview a chat list shows. */
  readonly lastMessage?: { readonly sender: string | null; readonly text: string; readonly ts: number };
}

export async function readLibrary(
  language: Language = "en",
): Promise<readonly LibraryEntry[]> {
  const entries: LibraryEntry[] = [];

  for (const archiveId of listArchiveIds()) {
    try {
      // `undefined`: a plain chat, no key needed. `null`: protected, and the key is not here.
      const key = await keyForArchive(archiveId);
      if (key === null) {
        entries.push({ archiveId, status: "locked" });
        continue;
      }

      const reader = await ArchiveReader.open({
        crypto: getCryptoProvider(),
        // Photos the phone no longer keeps are read back from Drive.
        storage: readableStorageFor(archiveId),
        key,
        archiveId,
      });

      // Reading every message to draw one row is more than a list should do, but the manifest
      // carries neither a preview line nor any link from a blob to the message that used it —
      // both are documented gaps in `packages/core`. The read is chunk-at-a-time and the
      // library holds a handful of archives; if that stops being true, the fix is a small
      // summary sealed into the archive at write time, not a cache out here.
      const messages = await reader.readAll();
      const { chatPhotoSha256 } = await readPreferences(archiveId);
      const thumbnail = findChatPhoto(
        buildMediaIndex(messages, reader.manifest.media),
        chatPhotoSha256,
      );
      const last = messages[messages.length - 1];

      entries.push({
        archiveId,
        status: "ready",
        manifest: reader.manifest,
        reader,
        ...(thumbnail ? { thumbnail } : {}),
        ...(last
          ? {
              lastMessage: {
                sender: last.sender,
                text: previewTextFor(last, language),
                ts: last.ts,
              },
            }
          : {}),
      });
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

/** The one-line preview, naming what a media message is rather than showing an empty line. */
function previewTextFor(message: { kind: string; body: string }, language: Language): string {
  if (message.body.length > 0) return message.body;
  if (message.kind === "attachment") return translate(language, "preview.photoOrFile");
  if (message.kind === "omitted-media") return translate(language, "preview.mediaMissing");
  if (message.kind === "deleted") return translate(language, "preview.deleted");
  return "";
}
