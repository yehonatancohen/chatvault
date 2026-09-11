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
  ?.env.GOOGLE_DRIVE_TEST_TOKEN?.trim().replace(/^["']|["']$/g, "");

describe.skipIf(token === undefined)("GoogleDriveStorageAdapter against real Google Drive", () => {
  const realFetch = (globalThis as unknown as { fetch: DriveFetch }).fetch;

  /**
   * Ask Google about the token before blaming the adapter. A bad token otherwise surfaces as a
   * bare 401 from the first Drive call, which says nothing about *why*.
   */
  it("has a usable drive.file access token", async () => {
    if (/^(4\/|1\/\/)/.test(token!)) {
      throw new Error(
        "GOOGLE_DRIVE_TEST_TOKEN looks like an authorization code (4/…) or a refresh token (1//…). " +
          "In the OAuth Playground, click 'Exchange authorization code for tokens' and copy the " +
          "*Access token* (it starts with ya29.).",
      );
    }
    const response = await realFetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token!)}`,
      { method: "GET", headers: {} },
    );
    const info = JSON.parse(await response.text()) as {
      scope?: string;
      expires_in?: string;
      error_description?: string;
    };
    if (response.status !== 200) {
      throw new Error(
        `Google does not accept this token (${info.error_description ?? response.status}). ` +
          "Access tokens expire after an hour — get a fresh one from the OAuth Playground.",
      );
    }
    expect(info.scope?.split(" ")).toContain("https://www.googleapis.com/auth/drive.file");
  });

  it("passes the storage contract", { timeout: 300_000 }, async () => {
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
