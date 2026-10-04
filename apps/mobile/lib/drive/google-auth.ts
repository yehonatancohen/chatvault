/**
 * Signing in with Google, for the one thing it is used for today: access to the user's Drive.
 *
 * `@react-native-google-signin/google-signin` rather than a browser OAuth flow, because the
 * native SDK keeps the refresh token in the Keychain itself and refreshes access tokens on its
 * own (`getTokens`). A browser flow would leave us storing a long-lived Google refresh token by
 * hand — the kind of secret this app should hold as few of as possible.
 *
 * **Scope is `drive.file` only** — the files this app creates, nothing else in the user's
 * Drive. Requested at sign-in, and again with `addScopes` for a user who signed in before it
 * was added or unticked it on Google's consent screen.
 *
 * Phase 1 also wants a Google ID token for the Supabase account (`ACCOUNTS-AND-CLOUD.md`). That
 * needs a *web* client ID in `configure` so the token's audience is one Supabase can verify, and
 * is left for when the account exists; nothing here depends on it.
 *
 * Device-only: this is a native module, so none of it runs under `pnpm test`.
 */

import { Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { DRIVE_SCOPE } from "@chatvault/storage";
import type { AccessTokenProvider } from "./drive-storage";

/**
 * The iOS OAuth client from the Google Cloud project. Not a secret — every iOS app ships its
 * client ID in the binary. Its reversed form is the URL scheme in `app.json`'s google-signin
 * plugin entry; change both together or sign-in will open and never come back.
 */
const IOS_CLIENT_ID = "139728547435-dsthuhtrdt4kqgvp5o23seuvsf5l3omr.apps.googleusercontent.com";

export interface GoogleConnection {
  readonly email: string;
  readonly name: string | null;
  /** False when the user signed in but declined Drive access on Google's consent screen. */
  readonly hasDrive: boolean;
}

import { accountEmail, sessionGeneration, setDriveAccount, assertDriveSession, subscribeDriveSession } from "./session";

let explicitlySignedOut = false;
let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({ iosClientId: IOS_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
}

/** The existing session, restored without showing anything. `null` when there is none. */
let restoring: Promise<GoogleConnection | null> | undefined;
export function restoreGoogleConnection(): Promise<GoogleConnection | null> {
  ensureConfigured();
  if (explicitlySignedOut) return Promise.resolve(null);
  const generation = sessionGeneration();
  restoring ??= (async () => {
    const result = GoogleSignin.hasPreviousSignIn() ? await GoogleSignin.signInSilently() : null;
    const connection = result?.type === "success" ? toConnection(result.data) : null;
    // A late silent sign-in must never resurrect an explicitly disconnected account.
    if (sessionGeneration() === generation) setDriveAccount(connection?.hasDrive ? connection.email : null);
    return sessionGeneration() === generation || accountEmail() === connection?.email ? connection : null;
  })().catch(error => { if (generation === sessionGeneration()) setDriveAccount(null); throw error; }).finally(() => { restoring = undefined; });
  return restoring;
}

/**
 * Show Google's sign-in and ask for Drive access. `null` if the user cancelled — a normal
 * outcome, not an error.
 */
export async function connectGoogleDrive(): Promise<GoogleConnection | null> {
  ensureConfigured();
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  try {
    const result = await GoogleSignin.signIn();
    if (result.type !== "success") return null;
    explicitlySignedOut = false;
    const connection = toConnection(result.data);
    if (connection.hasDrive) { cachedToken = undefined; setDriveAccount(connection.email); return connection; }

    // Signed in, but Drive was unticked on the consent screen: ask for it on its own.
    const added = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
    const finalConnection = added?.type === "success" ? toConnection(added.data) : connection;
    cachedToken = undefined;
    setDriveAccount(finalConnection.hasDrive ? finalConnection.email : null);
    return finalConnection;
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
}

/**
 * Disconnect, and revoke this app's access in the user's Google account — so "disconnect" means
 * what a user would assume, not merely "forget locally". Archives already in their Drive stay
 * there: they are the user's files.
 */
export async function disconnectGoogleDrive(): Promise<void> {
  ensureConfigured();
  explicitlySignedOut = true;
  cachedToken = undefined;
  setDriveAccount(null);
  // Switching accounts should sign out, not revoke the app's grant to existing Drive files.
  await GoogleSignin.signOut();
}

/**
 * Access tokens for `DriveClient`. `getTokens` refreshes an expired token itself. After a 401
 * the cached token is dropped first on Android, which caches aggressively; iOS has no such
 * cache to clear, and a token that still fails there means access was revoked — which the
 * client reports as `DriveAuthError`, the UI's cue to reconnect.
 */
export const googleAccessToken: AccessTokenProvider = async ({ forceRefresh }) => {
  ensureConfigured();
  const generation = sessionGeneration();
  assertDriveSession(generation);
  // Cached for a few minutes: a backup makes hundreds of requests, and asking the native SDK for
  // a token before each one was a measurable part of why uploads felt slow. A 401 still forces a
  // fresh one, so an expired cache costs one retried request.
  if (!forceRefresh && cachedToken !== undefined && Date.now() < cachedToken.until) {
    return cachedToken.token;
  }
  let { accessToken } = await GoogleSignin.getTokens();
  if (forceRefresh && Platform.OS === "android") {
    await GoogleSignin.clearCachedAccessToken(accessToken);
    accessToken = (await GoogleSignin.getTokens()).accessToken;
  }
  assertDriveSession(generation);
  cachedToken = { token: accessToken, until: Date.now() + TOKEN_CACHE_MS };
  return accessToken;
};

const TOKEN_CACHE_MS = 5 * 60 * 1000;
let cachedToken: { token: string; until: number } | undefined;
subscribeDriveSession(() => { cachedToken = undefined; });

function toConnection(data: {
  user: { email: string; name: string | null };
  scopes: string[];
}): GoogleConnection {
  return { email: data.user.email, name: data.user.name, hasDrive: data.scopes.includes(DRIVE_SCOPE) };
}

function isCancel(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === statusCodes.SIGN_IN_CANCELLED
  );
}
