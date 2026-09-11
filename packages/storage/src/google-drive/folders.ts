import { FOLDER_MIME, quote, type DriveClient, type DriveFile } from "./client.js";

/**
 * Where Boydem's archives sit in the user's Drive:
 *
 * ```
 * My Drive/
 *   Boydem/                     ← the app folder, found by appProperties, not by name
 *     <chat name>/              ← one folder per archive: header.json, chunks/, media/, …
 * ```
 *
 * **Found by tag, not by name.** Each folder carries an `appProperties` marker, so a user who
 * renames "Boydem" to "WhatsApp backups" or moves it elsewhere in their Drive does not make the
 * app lose its archives and silently start a second, empty folder.
 *
 * **Archive folders are named after the chat** (owner's decision, 2026-09-11), so the user's
 * Drive reads like their chat list. The caller chooses the name — the app passes the chat's
 * title for a plain chat, and something neutral for a protected one, whose title is otherwise
 * sealed. The folder is *found* by its archive-id tag, never by name, so renaming it (by us when
 * a title changes, or by the user) never loses it.
 *
 * With the `drive.file` scope, Drive only ever shows this app the files it created itself, so
 * these queries cannot see — or collide with — anything else in the user's Drive.
 */

export const APP_FOLDER_NAME = "Boydem";
const ROLE = "boydemRole";
const ARCHIVE_ID = "boydemArchiveId";

/** The Boydem folder in the user's Drive, if there is one. Never creates it (the web viewer uses this). */
export async function findAppFolder(client: DriveClient): Promise<string | undefined> {
  const existing = await client.listFiles(
    `appProperties has { key=${quote(ROLE)} and value='app' } and ` +
      `mimeType = ${quote(FOLDER_MIME)} and trashed = false`,
    "createdTime",
  );
  return existing[0]?.id;
}

/** The Boydem folder in the user's Drive, created on first use. Oldest wins if two exist. */
export async function ensureAppFolder(client: DriveClient): Promise<string> {
  return (await findAppFolder(client)) ?? (await client.createFolder(APP_FOLDER_NAME, undefined, { [ROLE]: "app" })).id;
}

/**
 * The folder holding one archive, created on first use and named `name` (the archive id if
 * none is given). An existing folder with a different name is renamed to match.
 */
export async function ensureArchiveFolder(
  client: DriveClient,
  appFolderId: string,
  archiveId: string,
  name: string = archiveId,
): Promise<string> {
  const existing = (await findArchiveFolders(client, appFolderId, archiveId))[0];
  if (existing === undefined) {
    return (await client.createFolder(name, appFolderId, { [ROLE]: "archive", [ARCHIVE_ID]: archiveId })).id;
  }
  if (existing.name !== name) await client.rename(existing.id, name);
  return existing.id;
}

/** Every archive in the user's Drive — what a second device lists to find what exists. */
export async function listArchiveFolders(
  client: DriveClient,
  appFolderId: string,
): Promise<{ readonly archiveId: string; readonly folderId: string; readonly name: string }[]> {
  const folders = await client.listFiles(
    `${quote(appFolderId)} in parents and appProperties has { key=${quote(ROLE)} and value='archive' } and ` +
      `mimeType = ${quote(FOLDER_MIME)} and trashed = false`,
    "createdTime",
  );
  const seen = new Set<string>();
  const out: { archiveId: string; folderId: string; name: string }[] = [];
  for (const folder of folders) {
    const archiveId = archiveIdOf(folder);
    if (archiveId === undefined || seen.has(archiveId)) continue;
    seen.add(archiveId);
    out.push({ archiveId, folderId: folder.id, name: folder.name });
  }
  return out;
}

function findArchiveFolders(
  client: DriveClient,
  appFolderId: string,
  archiveId: string,
): Promise<DriveFile[]> {
  return client.listFiles(
    `${quote(appFolderId)} in parents and ` +
      `appProperties has { key=${quote(ARCHIVE_ID)} and value=${quote(archiveId)} } and ` +
      `mimeType = ${quote(FOLDER_MIME)} and trashed = false`,
    "createdTime",
  );
}

function archiveIdOf(folder: DriveFile): string | undefined {
  return folder.appProperties?.[ARCHIVE_ID];
}
