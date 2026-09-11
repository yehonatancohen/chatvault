/**
 * Per-archive display preferences. Not archive content.
 *
 * Two things live here, both of which a WhatsApp export cannot tell us:
 *
 * - **Which participant is the person holding the phone.** Every line is `Sender: text`,
 *   including your own, so a chat rendered from an export has no "me" and every message lands
 *   on the left like a group you are only watching.
 * - **The chat's photo.** An export carries no contact or group picture at all. Anything we
 *   showed unprompted would be a guess dressed up as the real icon, so the user picks one of
 *   the chat's own photos, and until they do the chat gets initials.
 *
 * The photo is stored as a *content address* (`MediaRef.sha256`) into the archive, never as
 * image bytes: the picture itself stays sealed inside the archive, and nothing decrypted is
 * written out here. A pointer whose blob is gone simply falls back to initials.
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
  /** `MediaRef.sha256` of the image the user chose to stand for this chat. */
  readonly chatPhotoSha256?: string;
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
    const { selfParticipantId, chatPhotoSha256 } = parsed as Record<string, unknown>;
    return {
      ...(typeof selfParticipantId === "string" ? { selfParticipantId } : {}),
      ...(typeof chatPhotoSha256 === "string" ? { chatPhotoSha256 } : {}),
    };
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

/**
 * Change some preferences and keep the rest. `undefined` clears a field.
 *
 * The screens that set these each own one field, so a whole-object write from one of them
 * would silently erase the other's choice — picking a chat photo must not forget who "you" are.
 */
export async function updatePreferences(
  archiveId: string,
  patch: { readonly [K in keyof ArchivePreferences]?: ArchivePreferences[K] | undefined },
): Promise<ArchivePreferences> {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...(await readPreferences(archiveId)), ...patch })) {
    if (value !== undefined) merged[key] = value;
  }
  await writePreferences(archiveId, merged);
  return merged;
}

/**
 * Forget an archive's preferences, for when the archive itself is removed.
 *
 * Lives here rather than in `vault.ts` so that the path these files live at stays known to
 * exactly one module — a second copy of `"preferences"` elsewhere is how an orphan directory
 * starts. Absent is a normal state, so a missing file is not an error.
 */
export async function deletePreferences(archiveId: string): Promise<void> {
  const file = fileFor(archiveId);
  if (file.exists) file.delete();
}
