import { DRIVE_API, type DriveClient } from "./client.js";

/**
 * Sharing one chat by link, with Google Drive's own "anyone with the link can view".
 *
 * The owner's app turns it on for the chat's folder (every file inside inherits it); the website
 * then reads that folder with only a public API key — no sign-in for the person the link was sent
 * to, and no copy on Boydem's servers (root `CLAUDE.md`, invariant 2). Turning it off removes the
 * permission, and the link stops working.
 *
 * With the `drive.file` scope the app can share only what it created — exactly its own folders.
 */

interface Permission {
  readonly id: string;
  readonly type: string;
  readonly role: string;
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=UTF-8" };

export async function isSharedWithAnyone(client: DriveClient, fileId: string): Promise<boolean> {
  return (await anyonePermissions(client, fileId)).length > 0;
}

/** Turn on "anyone with the link can view". Idempotent. */
export async function shareWithAnyone(client: DriveClient, fileId: string): Promise<void> {
  if (await isSharedWithAnyone(client, fileId)) return;
  await client.request(`${DRIVE_API}/files/${fileId}/permissions?fields=id`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

/** Turn it off. Anyone holding the link loses access. Idempotent. */
export async function stopSharing(client: DriveClient, fileId: string): Promise<void> {
  for (const permission of await anyonePermissions(client, fileId)) {
    await client.request(
      `${DRIVE_API}/files/${fileId}/permissions/${permission.id}`,
      { method: "DELETE", headers: {} },
      [200, 204, 404],
    );
  }
}

async function anyonePermissions(client: DriveClient, fileId: string): Promise<Permission[]> {
  const result = await client.json<{ permissions?: Permission[] }>(
    `${DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,type,role)`,
    { method: "GET", headers: {} },
  );
  return (result.permissions ?? []).filter((p) => p.type === "anyone");
}
