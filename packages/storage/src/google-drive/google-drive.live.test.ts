import { describe, expect, it } from "vitest";
import { DriveClient, type DriveFetch } from "./client.js";
import { runLiveDriveContract } from "./live-contract.js";

/**
 * The storage contract against real Google Drive. Skipped unless a token is supplied:
 *
 * ```bash
 * GOOGLE_DRIVE_TEST_TOKEN=ya29.… pnpm --filter @chatvault/storage test
 * ```
 *
 * The token needs the `drive.file` scope. The quickest way to get one without any app setup is
 * https://developers.google.com/oauthplayground — select "Drive API v3 → .../auth/drive.file",
 * authorize **with a throwaway Google account**, exchange for tokens, and copy the access token.
 * It expires after an hour.
 */

const token = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
  ?.env.GOOGLE_DRIVE_TEST_TOKEN;

describe.skipIf(token === undefined)("GoogleDriveStorageAdapter against real Google Drive", () => {
  it("passes the storage contract", { timeout: 300_000 }, async () => {
    const realFetch = (globalThis as unknown as { fetch: DriveFetch }).fetch;
    const client = new DriveClient({
      fetch: (url, init) => realFetch(url, init),
      getAccessToken: () => Promise.resolve(token!),
    });

    const results = await runLiveDriveContract(client);
    const failures = results.filter((r) => r.status === "failed");
    expect(failures.map((f) => `${f.name}: ${f.detail}`)).toEqual([]);
    expect(results.filter((r) => r.status === "skipped")).toEqual([]);
  });
});
