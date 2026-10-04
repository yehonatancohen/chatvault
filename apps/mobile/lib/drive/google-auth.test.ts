import { beforeEach, expect, it, vi } from "vitest";
import { DRIVE_SCOPE } from "@chatvault/storage";
const sdk = vi.hoisted(() => ({ configure: vi.fn(), hasPreviousSignIn: vi.fn(), signInSilently: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), revokeAccess: vi.fn(), getTokens: vi.fn(), addScopes: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@react-native-google-signin/google-signin", () => ({ GoogleSignin: sdk, statusCodes: { SIGN_IN_CANCELLED: "cancel" } }));
const success = (email: string) => ({ type: "success", data: { user: { email, name: null }, scopes: [DRIVE_SCOPE] } });
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); sdk.hasPreviousSignIn.mockReturnValue(true); sdk.signOut.mockResolvedValue(null); });
it("disconnect invalidates the session immediately and keeps the Drive grant", async () => {
  const auth = await import("./google-auth"), session = await import("./session");
  sdk.signIn.mockResolvedValue(success("alice@example.com"));
  await auth.connectGoogleDrive();
  expect(session.accountEmail()).toBe("alice@example.com");
  await auth.disconnectGoogleDrive();
  expect(session.accountEmail()).toBeNull();
  expect(sdk.signOut).toHaveBeenCalledOnce();
  expect(sdk.revokeAccess).not.toHaveBeenCalled();
  expect(await auth.restoreGoogleConnection()).toBeNull();
});
it("a late silent sign-in cannot resurrect a disconnected account", async () => {
  const auth = await import("./google-auth"), session = await import("./session");
  let resolve!: (value: ReturnType<typeof success>) => void;
  sdk.signInSilently.mockReturnValue(new Promise(r => { resolve = r; }));
  const restoring = auth.restoreGoogleConnection();
  await auth.disconnectGoogleDrive();
  resolve(success("alice@example.com"));
  expect(await restoring).toBeNull();
  expect(session.accountEmail()).toBeNull();
});
it("never returns a cached token from the previous Google account", async () => {
  const auth = await import("./google-auth");
  sdk.signIn.mockResolvedValue(success("alice@example.com")); sdk.getTokens.mockResolvedValue({ accessToken: "alice-token" });
  await auth.connectGoogleDrive();
  expect(await auth.googleAccessToken({ forceRefresh: false })).toBe("alice-token");
  await auth.disconnectGoogleDrive();
  sdk.signIn.mockResolvedValue(success("bob@example.com")); sdk.getTokens.mockResolvedValue({ accessToken: "bob-token" });
  await auth.connectGoogleDrive();
  expect(await auth.googleAccessToken({ forceRefresh: false })).toBe("bob-token");
});
it("rejects a native token request that finishes after disconnect", async () => {
  const auth = await import("./google-auth");
  sdk.signIn.mockResolvedValue(success("alice@example.com"));
  await auth.connectGoogleDrive();
  let resolve!: (value: { accessToken: string }) => void;
  sdk.getTokens.mockReturnValue(new Promise(r => { resolve = r; }));
  const token = auth.googleAccessToken({ forceRefresh: false });
  await auth.disconnectGoogleDrive(); resolve({ accessToken: "alice-token" });
  await expect(token).rejects.toThrow("account changed");
});
