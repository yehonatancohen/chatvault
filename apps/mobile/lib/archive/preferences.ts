/**
 * Per-archive display preferences. Not archive content.
 *
 * Today this holds one thing: which participant is the person holding the phone. A WhatsApp
 * export does not say — every line is `Sender: text`, including your own — so a chat rendered
 * from it has no "me", and every message lands on the left like a group you are only watching.
 * Asking once, in the archive's info screen, is what lets the reader look like a conversation
 * you were part of.
 *
 * **Deliberately outside the archive directory.** `ArchiveStoragePort` holds sealed archive
 * objects and nothing else; a preferences file living among them would be an unencrypted,
 * unversioned member of a format whose whole point is that it is portable and self-describing.
 * This is device-local, disposable, and absent by default — losing it costs an alignment, not
 * data.
 */

import { Directory, File, Paths } from "expo-file-system";

export interface ArchivePreferences {
  /** `Manifest.participants[].id` of whoever owns this phone, when they have said. */
  readonly selfParticipantId?: string;
}

const DIRECTORY = "preferences";

function fileFor(archiveId: string): File {
  return new File(new Directory(Paths.document, DIRECTORY), `${archiveId}.json`);
}

export async function readPreferences(archiveId: string): Promise<ArchivePreferences> {
  const file = fileFor(archiveId);
  if (!file.exists) return {};
  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (typeof parsed !== "object" || parsed === null) return {};
    const { selfParticipantId } = parsed as Record<string, unknown>;
    return typeof selfParticipantId === "string" ? { selfParticipantId } : {};
  } catch {
    // A corrupt preferences file is a cosmetic problem; the archive is untouched by it, and
    // defaulting is better than making a reader screen fail to open over an alignment.
    return {};
  }
}

export async function writePreferences(
  archiveId: string,
  preferences: ArchivePreferences,
): Promise<void> {
  const file = fileFor(archiveId);
  file.parentDirectory.create({ intermediates: true, idempotent: true });
  file.write(JSON.stringify(preferences));
}
