/**
 * Google sign-in in the browser, for one thing: reading the chats in the user's own Drive.
 *
 * Google Identity Services' token client (`accounts.google.com/gsi/client`) — a popup, then a
 * short-lived access token held **in memory only** for this tab. Scope is `drive.file`: the
 * files Boydem's apps created, nothing else in the user's Drive. The phone and this site are two
 * OAuth clients of one Google Cloud project, so the site sees what the phone backed up.
 *
 * The script is loaded only on the pages that sign in (`/chats`), never site-wide — see
 * `apps/web/CLAUDE.md` on third-party scripts and pages that carry keys in the URL.
 */

import { DRIVE_SCOPE } from "@chatvault/storage";

interface TokenResponse {
  readonly access_token?: string;
  readonly expires_in?: number;
  readonly error?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

let token: { value: string; until: number } | undefined;
let scriptLoading: Promise<GoogleIdentity> | undefined;

export class SignedOutError extends Error {
  constructor() {
    super("Signed out of Google — sign in again to open your chats.");
    this.name = "SignedOutError";
  }
}

function loadScript(): Promise<GoogleIdentity> {
  scriptLoading ??= new Promise((resolve, reject) => {
    if (window.google) return resolve(window.google);
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error("Google sign-in did not load")));
    script.onerror = () => reject(new Error("Google sign-in could not be loaded"));
    document.head.appendChild(script);
  });
  return scriptLoading;
}

/** Load Google's script ahead of the click, so the popup opens from the click itself. */
export function prepareSignIn(): void {
  if (GOOGLE_CLIENT_ID !== "") void loadScript();
}

/** Show Google's popup and get a Drive token. Must be called from a click (popup rules). */
export async function signIn(): Promise<void> {
  if (GOOGLE_CLIENT_ID === "") throw new Error("Google sign-in is not configured for this site.");
  const google = await loadScript();
  await new Promise<void>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.access_token === undefined) return reject(new Error(response.error ?? "Sign-in failed"));
        // A minute's margin, so a request never goes out with a token about to lapse.
        token = { value: response.access_token, until: Date.now() + ((response.expires_in ?? 3600) - 60) * 1000 };
        resolve();
      },
      error_callback: (error) => reject(new Error(error.type === "popup_closed" ? "Sign-in was closed." : error.type)),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export function isSignedIn(): boolean {
  return token !== undefined && Date.now() < token.until;
}

/** For `DriveClient`. There is no silent refresh here — an expired token means signing in again. */
export async function accessToken(): Promise<string> {
  if (!isSignedIn()) throw new SignedOutError();
  return token!.value;
}

export function signOut(): void {
  if (token !== undefined) window.google?.accounts.oauth2.revoke(token.value);
  token = undefined;
}
