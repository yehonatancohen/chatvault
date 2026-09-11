/**
 * Sharing one chat by link.
 *
 * Turns on Google Drive's "anyone with the link can view" for the chat's folder, and builds a
 * link to the website's `/s/<folderId>` page, which reads the folder straight from Drive with no
 * sign-in (`apps/web/lib/shared-chat.ts`). A protected chat's key goes in the link's fragment —
 * the part after `#`, which browsers never send to any server. Nothing passes through Boydem's
 * servers (root `CLAUDE.md`, invariant 2).
 *
 * The chat must be in Drive first: the link points at its Drive folder.
 */

import Constants from "expo-constants";
import { isSharedWithAnyone, shareWithAnyone, stopSharing } from "@chatvault/storage";
import { keyForArchive } from "../archive/vault";
import { toBase64Url } from "../crypto/base64";
import { driveClient, folderIdFor } from "./drive-client";

/** The website's address, from `app.json` → `extra.webUrl`. Empty until the site is deployed. */
export function webUrl(): string {
  const extra = Constants.expoConfig?.extra as { webUrl?: unknown } | undefined;
  return typeof extra?.webUrl === "string" ? extra.webUrl.replace(/\/+$/, "") : "";
}

export class SiteNotSetError extends Error {
  constructor() {
    super("The website address isn't set yet.");
    this.name = "SiteNotSetError";
  }
}

/** Turn sharing on and return the link to send. */
export async function shareChat(archiveId: string): Promise<string> {
  const site = webUrl();
  if (site === "") throw new SiteNotSetError();
  const folderId = await folderIdFor(archiveId);
  await shareWithAnyone(driveClient(), folderId);
  const key = await keyForArchive(archiveId);
  if (key === null) throw new Error("This chat is locked on this phone; open it with its passphrase first.");
  return key === undefined ? `${site}/s/${folderId}` : `${site}/s/${folderId}#k=${toBase64Url(key)}`;
}

export async function stopSharingChat(archiveId: string): Promise<void> {
  await stopSharing(driveClient(), await folderIdFor(archiveId));
}

export async function isChatShared(archiveId: string): Promise<boolean> {
  try {
    return await isSharedWithAnyone(driveClient(), await folderIdFor(archiveId));
  } catch {
    return false; // not in Drive, or offline: nothing to show as shared
  }
}
