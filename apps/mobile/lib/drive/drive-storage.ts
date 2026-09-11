/**
 * Google Drive on the phone: the adapter from `@chatvault/storage`, wired to `expo/fetch`.
 *
 * `expo/fetch` rather than React Native's global `fetch`, because the global one is built on
 * XHR and hands binary responses back through a blob/FileReader path that has been unreliable
 * across RN versions — and every byte this carries is ciphertext that must round-trip exactly.
 *
 * **Where the token comes from is deliberately not decided here.** `getAccessToken` is injected
 * so that the Google sign-in (Phase 1 of `ACCOUNTS-AND-CLOUD.md`) can plug in once it exists,
 * and so that the dev screen can run the real-Drive contract today with a pasted token.
 *
 * Nothing in this file talks to Boydem's servers. Bytes go from this phone to the user's own
 * Drive and back (root `CLAUDE.md`, invariant 2).
 */

import { fetch as expoFetch } from "expo/fetch";
import {
  DriveClient,
  ensureAppFolder,
  ensureArchiveFolder,
  GoogleDriveStorageAdapter,
  type DriveClientOptions,
  type DriveFetch,
} from "@chatvault/storage";

export type AccessTokenProvider = DriveClientOptions["getAccessToken"];

const driveFetch: DriveFetch = (url, init) =>
  expoFetch(url, {
    method: init.method,
    headers: init.headers,
    ...(init.body !== undefined ? { body: init.body } : {}),
  });

export function createDriveClient(getAccessToken: AccessTokenProvider): DriveClient {
  return new DriveClient({ fetch: driveFetch, getAccessToken });
}

/** The storage for one archive in the user's Drive: `My Drive/Boydem/<archiveId>/`. */
export async function driveStorageFor(
  client: DriveClient,
  archiveId: string,
): Promise<GoogleDriveStorageAdapter> {
  const appFolderId = await ensureAppFolder(client);
  const rootFolderId = await ensureArchiveFolder(client, appFolderId, archiveId);
  return new GoogleDriveStorageAdapter({ client, rootFolderId });
}
