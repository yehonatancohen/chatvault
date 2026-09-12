/**
 * Getting Drive access for the visitor, without loading anything of Google's onto this page.
 *
 * **Why a popup on our own origin instead of Google's sign-in script.** A shared chat's page can
 * carry the archive key in its URL fragment, and `apps/web/CLAUDE.md` forbids any third-party
 * script on `/s/` pages for exactly that reason: a script on the page can read `location`, and
 * one that phones home takes the key with it. So the OAuth flow happens in a separate window at
 * `/connect` — our origin, a URL with no key in it, no imported script anywhere — and hands the
 * access token back through `postMessage`.
 *
 * The token lives in memory for as long as the tab is open and is never written to
 * `localStorage`, `sessionStorage` or a cookie: a bearer token for someone's Drive is not
 * something to leave on disk.
 */

export const DRIVE_TOKEN_MESSAGE = "boydem-drive-token";

export interface DriveTokenMessage {
  readonly type: typeof DRIVE_TOKEN_MESSAGE;
  readonly token?: string;
  readonly error?: string;
}

/** The visitor closed the window, or said no on Google's screen. Ordinary, not a failure. */
export class DriveAccessCancelled extends Error {
  constructor() {
    super("החיבור ל-Google Drive בוטל.");
    this.name = "DriveAccessCancelled";
  }
}

/**
 * Open the connect window and resolve with an access token carrying the `drive.file` scope.
 *
 * Must be called straight from a click: browsers block `window.open` otherwise.
 */
export function requestDriveAccess(): Promise<string> {
  // No `noopener`: the connect window hands the token back through `window.opener`.
  const popup = window.open("/connect", "boydem-drive", "width=480,height=680");
  if (popup === null) {
    return Promise.reject(new Error("הדפדפן חסם את חלון החיבור ל-Google. אפשרו חלונות קופצים ונסו שוב."));
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const finish = (run: () => void): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedTimer);
      run();
    };

    const onMessage = (event: MessageEvent): void => {
      // Same origin *and* same window: another tab of this site must not be able to feed us one.
      if (event.origin !== window.location.origin || event.source !== popup) return;
      const data = event.data as DriveTokenMessage | undefined;
      if (data?.type !== DRIVE_TOKEN_MESSAGE) return;
      popup.close();
      finish(() =>
        typeof data.token === "string" && data.token !== ""
          ? resolve(data.token)
          : reject(data.error === undefined ? new DriveAccessCancelled() : new Error(data.error)),
      );
    };

    window.addEventListener("message", onMessage);
    // A closed window sends nothing, so the only way to notice "they changed their mind" is to
    // watch for it. `closed` is readable cross-origin while Google's own page is showing.
    const closedTimer = window.setInterval(() => {
      if (popup.closed) finish(() => reject(new DriveAccessCancelled()));
    }, 500);
  });
}
