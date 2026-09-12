"use client";

import { useEffect, useState } from "react";
import { DRIVE_SCOPE } from "@chatvault/storage";
import { DRIVE_TOKEN_MESSAGE, type DriveTokenMessage } from "../../lib/google-oauth";
import { GOOGLE_CLIENT_ID } from "../../lib/site";

/**
 * The whole Google OAuth flow, in one page that is only ever a popup.
 *
 * It exists so that the viewer page — whose URL may carry an archive key in its fragment — never
 * loads a line of Google's JavaScript (`apps/web/CLAUDE.md`, "The rule for pages that carry a
 * key"). This page's own URL has no key in it, so sending the browser to Google from here is
 * safe in a way it would not be from `/s/<folderId>#k=…`.
 *
 * Two visits: the first sends the browser to Google, the second is Google sending it back with
 * `#access_token=…`, which is handed to the opener by `postMessage` and then wiped from the
 * address bar. `state` is a one-time value kept in this window's `sessionStorage`, which is what
 * makes a token planted by someone else's link fail instead of being trusted.
 *
 * The token is only ever a Drive access token — it is not a Boydem account, and there is no
 * sign-in on this site (root `ACCOUNTS-AND-CLOUD.md`).
 */

const STATE_KEY = "boydem.oauth.state";

export default function ConnectPage() {
  const [problem, setProblem] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID === "") {
      setProblem("שמירה ל-Drive עדיין לא מוגדרת באתר הזה.");
      return;
    }

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("access_token");
    const error = params.get("error");
    const expected = window.sessionStorage.getItem(STATE_KEY);

    if (token === null && error === null) {
      const state = crypto.randomUUID();
      window.sessionStorage.setItem(STATE_KEY, state);
      window.location.replace(authorizeUrl(state));
      return;
    }

    // Nothing is trusted until the state matches: this window started the flow it is finishing.
    window.sessionStorage.removeItem(STATE_KEY);
    const matched = expected !== null && params.get("state") === expected;
    // The token is out of the address bar before anything else happens, so a screenshot, a
    // shared link or the browser's history never carries someone's Drive token.
    window.history.replaceState(null, "", window.location.pathname);

    const message: DriveTokenMessage =
      token !== null && matched
        ? { type: DRIVE_TOKEN_MESSAGE, token }
        : {
            type: DRIVE_TOKEN_MESSAGE,
            ...(error === "access_denied" || !matched ? {} : { error: "החיבור ל-Google Drive נכשל." }),
          };

    if (window.opener === null) {
      setProblem(token !== null && matched ? "החלון שממנו התחלתם נסגר. חזרו לצ׳אט ונסו שוב." : undefined);
      return;
    }
    (window.opener as Window).postMessage(message, window.location.origin);
    window.close();
  }, []);

  return (
    <main className="shared-status" dir="auto">
      <p>{problem ?? "מתחברים ל-Google Drive…"}</p>
    </main>
  );
}

function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${window.location.origin}/connect`,
    response_type: "token",
    scope: DRIVE_SCOPE,
    state,
    include_granted_scopes: "true",
    // Google shows the account chooser rather than silently reusing whichever account the
    // browser happens to be signed into — the chat is about to land in that account's Drive.
    prompt: "select_account consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
