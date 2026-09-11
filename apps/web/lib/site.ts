/**
 * Site-wide settings, from the environment.
 *
 * - `NEXT_PUBLIC_GOOGLE_API_KEY` — a Google Cloud API key restricted to the Drive API and to this
 *   site's domain. It reads chats people shared by link; it identifies the site, it is not a
 *   login, and it can read nothing that was not shared "anyone with the link".
 * - `NEXT_PUBLIC_APP_STORE_URL` — where "Get the app" goes. Until the app is in the App Store,
 *   unset, and the button says it is coming soon.
 */

export const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
