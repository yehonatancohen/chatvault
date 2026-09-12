/**
 * Site-wide settings, from the environment.
 *
 * - `NEXT_PUBLIC_GOOGLE_API_KEY` — a Google Cloud API key restricted to the Drive API and to this
 *   site's domain. It reads chats people shared by link; it identifies the site, it is not a
 *   login, and it can read nothing that was not shared "anyone with the link".
 * - `NEXT_PUBLIC_APP_STORE_URL` — where "Get the app" goes. Until the app is in the App Store,
 *   unset, and the button says it is coming soon.
 * - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — the Google Cloud **Web** OAuth client, same project as the
 *   app's iOS client. It is what lets a visitor keep a chat someone shared with them, by copying
 *   it into their own Drive (`lib/save-to-drive.ts`). Not a secret: a browser client ID is
 *   public by design, and it is useless without this site's origin, which Google checks. Unset
 *   until the owner creates it, and then "keep this chat" simply isn't offered.
 *
 * In the Cloud console the client needs this site's origin under **Authorized JavaScript
 * origins**, and `<origin>/connect` under **Authorized redirect URIs** — that route is the whole
 * OAuth flow (`app/connect/page.tsx`), and it exists so no Google script is ever loaded on a
 * page whose URL carries an archive key.
 */

export const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
