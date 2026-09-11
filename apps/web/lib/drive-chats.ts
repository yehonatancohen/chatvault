/**
 * The user's chats in their Google Drive, as the phone backed them up — read straight from
 * Drive in this tab. Nothing passes through Boydem's servers (root `CLAUDE.md`, invariant 2).
 */

import { ArchiveReader, createWebCryptoProvider, isPlainHeader, readHeader } from "@chatvault/core";
import {
  DriveClient,
  findAppFolder,
  GoogleDriveStorageAdapter,
  listArchiveFolders,
  type DriveFetch,
} from "@chatvault/storage";
import { accessToken } from "./google";

export interface DriveChat {
  readonly folderId: string;
  readonly archiveId: string;
  readonly name: string;
}

let client: DriveClient | undefined;

function driveClient(): DriveClient {
  const browserFetch: DriveFetch = (url, init) =>
    fetch(url, {
      method: init.method,
      headers: init.headers,
      ...(init.body !== undefined ? { body: init.body as BodyInit } : {}),
    });
  client ??= new DriveClient({ fetch: browserFetch, getAccessToken: () => accessToken() });
  return client;
}

export function webCrypto() {
  return createWebCryptoProvider(window.crypto.subtle, (array) => window.crypto.getRandomValues(array));
}

/** Every chat in the user's Boydem folder. Empty if the phone has never backed anything up. */
export async function listDriveChats(): Promise<DriveChat[]> {
  const appFolder = await findAppFolder(driveClient());
  if (appFolder === undefined) return [];
  return listArchiveFolders(driveClient(), appFolder);
}

export type OpenedDriveChat =
  | { readonly kind: "open"; readonly reader: ArchiveReader }
  | {
      readonly kind: "protected";
      readonly storage: GoogleDriveStorageAdapter;
      readonly archiveId: string;
    };

/** Open a chat from its Drive folder; a protected one comes back needing its passphrase. */
export async function openDriveChat(folderId: string): Promise<OpenedDriveChat> {
  const storage = new GoogleDriveStorageAdapter({ client: driveClient(), rootFolderId: folderId });
  // One listing first: every later "is it there?" (previews, media) is then answered from it.
  await storage.list("");
  const raw = JSON.parse(new TextDecoder().decode(await storage.get("header.json"))) as { archiveId?: unknown };
  if (typeof raw.archiveId !== "string") throw new Error("This folder is not a Boydem chat.");
  const header = await readHeader(storage, raw.archiveId);
  if (!isPlainHeader(header)) return { kind: "protected", storage, archiveId: raw.archiveId };
  const reader = await ArchiveReader.open({ crypto: webCrypto(), storage, archiveId: raw.archiveId });
  return { kind: "open", reader };
}
