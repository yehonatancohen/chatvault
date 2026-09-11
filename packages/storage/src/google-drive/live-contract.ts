import { runStorageContract, type ContractResult } from "../contract.js";
import { GoogleDriveStorageAdapter } from "./adapter.js";
import { DRIVE_API, type DriveClient } from "./client.js";

/**
 * The storage contract against the **real** Google Drive — the manual run
 * `packages/storage/CLAUDE.md` requires of every cloud adapter, because quotas, token expiry and
 * Drive's actual query and upload behaviour are exactly what `FakeDrive` cannot reproduce.
 *
 * Two places call it: `google-drive.live.test.ts` from a laptop (Node's fetch), and the mobile
 * dev screen on a phone (`expo/fetch`) — the second matters on its own, since the upload path
 * leans on how the platform's HTTP stack treats Drive's `308 Resume Incomplete`.
 *
 * Every case gets a fresh folder inside one dated run folder at the top of My Drive, and the
 * run folder is moved to the Drive trash afterwards. **Use a throwaway Google account**, never
 * the one holding real archives.
 */
export async function runLiveDriveContract(client: DriveClient): Promise<readonly ContractResult[]> {
  const run = await client.createFolder(`Boydem contract run ${new Date().toISOString()}`, undefined);
  try {
    return await runStorageContract(async (caseName) => {
      const folder = await client.createFolder(caseName.slice(0, 60), run.id);
      return new GoogleDriveStorageAdapter({
        client,
        rootFolderId: folder.id,
        // The smallest chunk Drive allows, so the streaming cases cross a chunk boundary rarely
        // but cheaply if they ever grow; the contract's own blobs are tiny.
        uploadChunkBytes: 256 * 1024,
      });
    });
  } finally {
    await client
      .request(
        `${DRIVE_API}/files/${run.id}?fields=id`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: '{"trashed":true}',
        },
      )
      .catch(() => {
        // Leaving a test folder behind is untidy, not a contract failure.
      });
  }
}
