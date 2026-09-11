import { FOLDER_MIME, quote, type DriveClient, type DriveFile } from "./client.js";

/**
 * Where Boydem's archives sit in the user's Drive:
 *
 * ```
 * My Drive/
 *   Boydem/                     ← the app folder, found by appProperties, not by name
 *     <archiveId>/              ← one folder per archive: header.json, chunks/, media/, …
 * ```
 *
 * **Found by tag, not by name.** Each folder carries an `appProperties` marker, so a user who
 * renames "Boydem" to "WhatsApp backups" or moves it elsewhere in their Drive does not make the
 * app lose its archives and silently start a second, empty folder.
 *
 * **Archive folders are named by archive id, not by chat title.** The title is personal data —
 * often a person's name — and a folder name is visible to anyone the folder is ever shared with,
 * and in Drive's search and activity feeds. The id reveals nothing; the title lives inside the
 * sealed manifest where it belongs.
 *
 * With the `drive.file` scope, Drive only ever shows this app the files it created itself, so
 * these queries cannot see — or collide with — anything else in the user's Drive.
 */

export const APP_FOLDER_NAME = "Boydem";
const ROLE = "boydemRole";
const ARCHIVE_ID = "boydemArchiveId";

/** The Boydem folder in the user's Drive, created on first use. Oldest wins if two exist. */
export async function ensureAppFolder(client: DriveClient): Promise<string> {
  const existing = await client.listFiles(
    `appProperties has { key=${quote(ROLE)} and value='app' } and ` +
      `mimeType = ${quote(FOLDER_MIME)} and trashed = false`,
    "createdTime",
  );
  if (existing[0] !== undefined) return existing[0].id;
  return (await client.createFolder(APP_FOLDER_NAME, undefined, { [ROLE]: "app" })).id;
}

/** The folder holding one archive, created on first use. */
export async function ensureArchiveFolder(
  client: DriveClient,
  appFolderId: string,
  archiveId: string,
): Promise<string> {
  const existing = await findArchiveFolders(client, appFolderId, archiveId);
  if (existing[0] !== undefined) return existing[0].id;
  return (
    await client.createFolder(archiveId, appFolderId, { [ROLE]: "archive", [ARCHIVE_ID]: archiveId })
  ).id;
}

/** Every archive in the user's Drive — what a second device lists to find what exists. */
export async function listArchiveFolders(
  client: DriveClient,
  appFolderId: string,
): Promise<{ readonly archiveId: string; readonly folderId: string }[]> {
  const folders = await client.listFiles(
    `${quote(appFolderId)} in parents and appProperties has { key=${quote(ROLE)} and value='archive' } and ` +
      `mimeType = ${quote(FOLDER_MIME)} and trashed = false`,
    "createdTime",
  );
  const seen = new Set<string>();
  const out: { archiveId: string; folderId: string }[] = [];
  for (const folder of folders) {
    const archiveId = archiveIdOf(folder);
    if (archiveId === undefined || seen.has(archiveId)) continue;
    seen.add(archiveId);
    out.push({ archiveId, folderId: folder.id });
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
