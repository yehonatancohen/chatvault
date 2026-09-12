# @chatvault/web

Next.js App Router on Vercel. Read the root `CLAUDE.md` first.

**The website has exactly two jobs (owner, 2026-09-11):**

1. **The home page** (`app/page.tsx`) — what Boydem is, how it works, prices. Every path leads to
   the app (`GetTheApp`).
2. **A chat someone shared** (`app/s/[folderId]/page.tsx`) — read it in the browser, no sign-in,
   then get the app to save your own.

**No sign-in, no accounts, no tools on the website.** Saving chats, backing up, adding exports —
all of it happens in the app. Don't add a login, a file picker or an "upload" here; the goal is
to send people to the app.

**One amendment (owner, 2026-09-12): a reader may keep the chat they were shown.**
"שמירה אצלי" on a shared chat copies the archive folder into **the reader's own Google Drive**
(`lib/save-to-drive.ts`), and the app finds it there afterwards — "Download them" on the Account
tab restores it on any phone signed into that Google account. That is the whole feature, and the
rule above still holds in the part that matters:

- **It is not a Boydem sign-in.** There is no account, no session and no cookie on this site. The
  only thing obtained is a Google Drive access token, held in memory for the life of the tab.
- **Nothing lands on our servers**, then or ever — the bytes go owner's Drive → this browser →
  reader's Drive (invariant 2).
- A chat kept this way **counts as one of the reader's chats** once billing exists
  (`ACCOUNTS-AND-CLOUD.md` § 3); the dialog says so, and says the app reads a chat better than a
  browser does. Nothing here enforces it — enforcement lives in the app and the API.

## Commands

```bash
pnpm dev         # next dev
pnpm build       # catches Server/Client Component mistakes that dev mode tolerates
pnpm typecheck
```

## How a shared chat reaches this site

In the app, "Share chat" turns on Google Drive's **"anyone with the link can view"** for that
chat's folder (`packages/storage/src/google-drive/sharing.ts`) and sends a link to
`/s/<folderId>`. This page reads the folder **straight from Drive in the browser**, with only the
site's public API key (`lib/shared-chat.ts`) — the same `GoogleDriveStorageAdapter` the phone
uses. Nothing passes through Boydem's servers (invariant 2). "Stop sharing" in the app removes
the permission and the link stops working.

- **Plain chats** open directly. **Protected chats** carry their key in the URL fragment,
  `#k=<base64url key>` (`lib/fragment-key.ts`).
- Photos draw their small previews; full photos load when opened; videos and files load only
  when tapped — every byte shown is a Drive download.

## The rule for pages that carry a key

**The key lives in the URL fragment and must never leave the browser.** Browsers do not send
the fragment to the server, do not include it in `Referer`, and do not log it.

- **Anything touching a key is a Client Component.** A Server Component cannot see the fragment.
- **Never serialize a URL with its fragment** — not to analytics, an error reporter, `fetch` or a
  log line. `withoutKey()` in `lib/fragment-key.ts`.
- **No third-party script on `/s/` pages**, and none site-wide that reads `location` —
  session-replay and most analytics capture full URLs and would leak keys wholesale.
  **This is why Drive access is not Google's sign-in script.** `app/connect/page.tsx` is a popup
  on our own origin — a URL with no key in it — that runs the OAuth redirect by hand and hands
  the token back with `postMessage` (same origin, same window, one-time `state`). Google's script
  would have had to load on the page holding the key. If that route is ever replaced by GIS, keep
  it in the popup: the viewer page must stay free of imported scripts.
- `metadata.referrer` is `no-referrer` in `app/layout.tsx`. Do not relax it. The one exception is
  the Drive requests in `lib/shared-chat.ts`, which send `referrerPolicy: "origin"` — the site's
  bare origin, no path or fragment — because the API key's website restriction checks it.

## Configuration (`lib/site.ts`)

| Variable | What |
|---|---|
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Google Cloud **API key** (not an OAuth client), same project as the app. Restrict it to the *Google Drive API* and, under website restrictions, to this site's domain. It reads only what was shared "anyone with the link". Without it, `/s/` pages say sharing is not set up. |
| `NEXT_PUBLIC_APP_STORE_URL` | Where "Get the app" goes. Unset until the app is in the App Store — the button then says "coming soon". |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud **Web** OAuth client, same project as the app's iOS client. Powers "keep this chat" only. In the console it needs this site's origin under *Authorized JavaScript origins* and `<origin>/connect` under *Authorized redirect URIs*. Unset → the button is not shown at all, and `/connect` says so. |

## Deploying (Vercel)

Import the GitHub repo in Vercel with **Root Directory `apps/web`** (the pnpm workspace and
`patches/` are picked up from the repo root). Set the variables above. Pushes to the production
branch redeploy. The app's `app.json` → `extra.webUrl` must be this site's address, or the
links it shares point nowhere.

## How to test this app

**The privacy check is manual and it matters most.** Open a protected shared chat's link, then in
DevTools → Network confirm that no request — document, RSC payload, image, beacon — contains the
key or the fragment. Do it after any change to routing, layout, metadata or dependencies.

Also by hand: a turned-off link shows "This chat isn't available", not a crash; a protected link
without its key shows `MissingKeyError`'s message; a long chat scrolls smoothly (virtualized) and
**opens at its last message**, with the jump-to-bottom button appearing only once you scroll away.

**"Keep this chat" can only be checked with two Google accounts** — one owning the shared chat,
one keeping it — and a client ID whose origins include wherever you are testing. What to watch
for: the popup completes and closes; the copy appears under `My Drive/Boydem/<chat>/` in the
*second* account; a second attempt says "already saved" rather than copying again; and, for a
protected chat, the copy is still sealed and the key never appears in any request.

The Drive side is covered in CI by `packages/storage` → `sync.test.ts` → "sharing a chat by
link" (API-key reads work only while shared; writes are refused).

## Structure

| Path | Role |
|---|---|
| `app/page.tsx` | Home: hero, how it works, why, prices — Hebrew, RTL. |
| `app/s/[folderId]/page.tsx` | A shared chat. Client-only (the key is in the fragment). |
| `app/connect/page.tsx` | The Google OAuth popup, and nothing else. Never linked; opened by `requestDriveAccess`. |
| `app/_components/` | The viewer: `MessageList` (react-virtuoso; opens at the end, jump-to-bottom), `MessageBubble` (`unicodeBidi: "plaintext"` makes RTL right per message), `MediaAttachment` (previews first, full on demand), `Lightbox`, `ChatInfo`, `SaveChat`, `AppBanner`, `GetTheApp`. |
| `lib/shared-chat.ts` | Folder id + fragment → `SharedChat` (reader + the Drive storage it came from), over Drive with the API key. |
| `lib/chat.ts` | Day separators, grouping runs, Hebrew labels, colours, sizes — **a port of the app's `lib/ui/chat.ts`**, which is where these rules are tested. Change the two together. |
| `lib/save-to-drive.ts`, `lib/google-oauth.ts` | Keeping a copy: `pullArchive` into the reader's Drive, and the token that allows it. |
| `lib/fragment-key.ts` | Reading and stripping the key from `location.hash`. |
| `lib/site.ts`, `lib/mime.ts` | Configuration; small helpers. |

**There is no test runner in this app.** What is testable lives in `core` and `storage` and is
tested there; `lib/chat.ts` is the one piece of real logic here, and it is a copy of a module
that `apps/mobile` tests (`lib/ui/chat.test.ts`). If it grows its own rules, move it somewhere
that runs tests rather than leaving it uncovered.

**`next.config.ts` needs `webpack.resolve.extensionAlias`**: `core` imports `.ts` files with
explicit `.js` extensions (NodeNext-style, which keeps it isomorphic — invariant 3). Without the
alias `next build` fails on every `core` import while `dev` and `tsc` stay silent.
