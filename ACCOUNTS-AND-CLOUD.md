# Accounts, subscriptions and cloud storage — plan

Status: **Phase 1 in progress** — Google Drive storage, sign-in, backup and restore are built (see "Done" at the bottom); accounts are next. Written 2026-09-11
after the product direction changed: Boydem gets real accounts and a subscription, and chats are
stored in the user's own cloud storage. Supersedes Track C in `ROADMAP.md`. Root `CLAUDE.md`
invariant 2 has been rewritten to match.

---

## What the owner decided

| Topic | Decision |
|---|---|
| Accounts | Yes. Sign in, see your chats on any device, share them, grant access. |
| **Where chats live** | **Never on Boydem's servers — not even encrypted.** On the phone and in storage the user owns: Google Drive, Dropbox, iCloud. Our backend holds only accounts, subscriptions and sharing records. |
| Money | A subscription priced by number of chats: **up to 5 free · 6–20 for ₪10/month · 21+ for ₪20/month.** Numbers will move; the shape is the point. 1:1 chats and groups count the same. |
| Encryption | **Opt-in.** Chats are saved as plain, readable files by default — on the phone and in Drive. "Protect with a passphrase" at import (or as the default in Settings) seals a chat end-to-end. *(Built — see "Done".)* A recovery key for protected chats is still to do. |
| Who needs an account | The app, always. **The website never** — it is a home page and a viewer for chats shared by link. |
| Destinations | Drive, Dropbox and iCloud are available on **every tier**, free included. |
| Backend | **Supabase** (Postgres + auth). |
| Chat icon | Initials by default; the user can pick a photo from the chat. *(Built.)* |

What the subscription pays for is **the service** — the app, merging group members' exports,
sharing, the viewer — not storage. That's also why the numbers work at any size: a user's media
costs us nothing, because it lands in their Drive, not ours. There is no storage cap to decide.

---

## 1. Plain by default, protected by choice

*Revised 2026-09-11 — replaces the earlier "Standard mode" (a server-held wrapping key), which
is dropped: with chats plain by default there is nothing for a server key to do.*

| | **Plain** (default) | **Protected** (opt-in) |
|---|---|---|
| On disk | Ordinary files: `manifest.json`, `chunks/*.jsonl`, `media/<hash>.jpg`, a readable `chat.txt` (format v2) | Every payload AES-GCM sealed (format v1, unchanged) |
| Opens with | Nothing — including without Boydem, straight from Drive | Its passphrase |
| Who can read the Drive copy | Anyone with access to the user's Google account or a shared link | Only someone with the passphrase |
| Forgot passphrase | n/a | Unrecoverable — a recovery key is the remaining work |
| Our servers | Hold nothing of it | Hold nothing of it |

The user chooses per chat at import ("Protect with a passphrase" switch), with the switch's
default set in Settings. A chat keeps its kind forever: appends follow the archive's header.

## 2. Accounts and backend

- **Sign-in:** Sign in with Apple and Google. Apple requires Sign in with Apple when Google is
  offered, and it's the smoothest option on iPhone anyway. Email magic link on the web.
- **Supabase** holds: accounts, archive records (id, owner, which destination, member list),
  memberships and roles, share-link tokens, subscription state. **No keys.** It's plain Postgres
  underneath, so it moves to any Postgres host if outgrown.
- **`apps/api`** stays small: auth, archives/memberships, RevenueCat webhook. It never receives
  a chat, a chunk, a media file, an archive key or a passphrase.
- **The phone stays the source of truth.** Parse, verify, encrypt on the device as today, write
  locally, then sync to the user's storage. The existing, device-proven pipeline is reused as is,
  and the app works offline.

## 3. Subscription

- **What's counted:** chats (archives) the user *owns*, 1:1 and groups alike.
- **Never blocked:** appending a newer export to a chat you already have, reading anything, and
  contributing to a chat someone shared with you (that counts against the owner). Merging group
  members' exports is the growth loop; the paywall must never stand in front of it.
- **Paywall moment:** importing a *new* chat while at the limit.
- **Lapsed payment / downgrade:** everything stays readable; only new chats are blocked. And
  because the files are in the user's own storage, we couldn't delete them if we wanted to —
  worth saying in the marketing.
- **Payments:** Apple In-App Purchase and Google Play Billing are required for digital
  subscriptions sold inside the apps. **RevenueCat** on top of both: one SDK, one webhook to our
  API, one "active plan" per account. Apple takes 15% under the Small Business Program.
- **Enforcement is honest, not airtight.** The files are the user's, so someone determined could
  copy an archive around by hand. The limit is enforced where the value is: creating an archive
  record and sharing go through our API.

## 4. Sharing and access

Roles per archive: **owner** (billing, delete), **contributor** (can add their own export of the
same chat), **viewer** (read only).

- **Signed-out viewers on the website are a main path, not an edge case.** A group member opens a
  link, reads the chat in the browser with no account, and ends on "Add your own export of this
  chat" → sign up. That is probably the main way new users arrive.
- **A viewer can keep the chat without an account** *(built 2026-09-12)*. "שמירה אצלי" copies the
  archive folder into the viewer's **own** Google Drive, in the browser, with `pullArchive` — the
  same copy the app performs on a restore, so the app picks it up from Drive afterwards. It is a
  Drive token, not a Boydem session: the website still has no sign-in. Protected chats copy still
  sealed; the key stays in the tab. The copy **counts as one of that user's chats** — the dialog
  says so, and enforcement stays where it can be enforced, in the app and the API.
- **How a viewer gets the bytes:** from the owner's storage, directly into the browser — never
  through us. For Drive and Dropbox that means the archive folder is shared by link in the
  owner's account, and the viewer's browser downloads the sealed files from there.
  **To verify before building:** that Drive (`files.get?alt=media` with an API key) and Dropbox
  shared links can be fetched from a browser (CORS) for a signed-out visitor.
- **iCloud archives can't be opened from the website** — Apple offers no way in. The share
  button on an iCloud archive has to say so, or offer to move it to Drive/Dropbox.
- **Plain chats:** sharing is sharing the Drive folder; the web viewer reads the plain files.
  **Protected chats:** the key travels in the URL fragment, never sent to the server.
- **Protected sharing between accounts:** each account gets a keypair when it first protects a
  chat, and sharing wraps the archive key to the recipient's public key.
- **Contributors writing into someone else's storage** is the hard part — see "Open design
  questions".

## 5. Destinations

Every write already goes through `StorageAdapter` (`packages/storage/src/adapter.ts`), and
`runStorageConformance` is the test each adapter must pass, on a device.

| Adapter | Notes |
|---|---|
| **Google Drive** — first | Reachable from iOS, Android and the web. Use the `drive.file` scope (only files we create) — broader scopes trigger Google's paid security assessment. |
| **Dropbox** | "App folder" access. Straightforward REST. |
| **iCloud Drive** | iOS only, needs a native module, **not readable from the website** (`webReadable: false`). The destination picker says so before the user chooses it. |
| OneDrive | Only if users ask. |

**Syncing.** The format is append-only and content-addressed: new chunks and media are new files,
nothing is rewritten, and the manifest is the one file that changes. So a sync is "upload what's
missing, then replace the manifest last". Uploads of hundreds of MB must survive the app being
backgrounded: iOS background upload sessions, resumable, with progress in the UI.

---

## Phases

Each phase ships something a user can see. The Track A gate in `ROADMAP.md` (one real import on
a phone) still comes first — everything below syncs what that pipeline produces.

| # | Phase | Ships |
|---|---|---|
| 0 | Settle the open design questions below | — |
| 1 | **Accounts + Google Drive** | Sign in, chats sync to your Drive, open on a second device. Free tier enforced at 5. (Drive, plain format v2 and backup are built.) |
| 2 | **Subscriptions** | RevenueCat, the two paid tiers, paywall on the 6th chat, restore purchases. |
| 3 | **Sharing** | Share links, the signed-out web viewer, roles, contributors. |
| 4 | **Protected chats, finished** | Opt-in at import is built; still to do: recovery key, and keypairs for sharing protected chats. |
| 5 | **Dropbox, then iCloud** | Same adapter contract; iCloud with its web limitation surfaced. |

## Open design questions

1. **How does a contributor add to an archive that lives in someone else's Drive?** Options:
   (a) the owner's app shares the Drive folder with the contributor's Google account, so they
   need a Google account and write access; (b) each contributor keeps their contribution in
   *their own* storage and the archive is the union across locations; (c) the contributor sends
   their sealed contribution to the owner's device, which merges and syncs. (a) is simplest.
   Whichever it is, per-writer manifest files (`manifests/<writer>.json.enc`, read as a union)
   would remove write conflicts entirely — merge is commutative and idempotent (invariant 5), so
   there is nothing to lock. Needs checking against `packages/core` before committing to it.
2. **Browser access to shared Drive/Dropbox files** — the verification in section 4. If it fails
   for one provider, that provider can't power the signed-out viewer.
3. **Existing local archives** on testers' phones: sync as protected (they already have a
   passphrase) and stay protected. Assumed.

---

## Done

- **Google Drive storage adapter (2026-09-11) — Phase 1, first half.** `packages/storage/src/
  google-drive/`: archives stored as real folders under `My Drive/Boydem/<archiveId>/`,
  `drive.file` scope only, resumable chunked uploads that resume correctly after a dropped
  connection, ranged downloads, token refresh on 401, backoff on rate limits, tolerant of
  duplicate names, removals go to the Drive trash. Passes the full storage contract (including
  streaming) against `FakeDrive` in CI, plus 15 Drive-specific tests. Mobile wiring over
  `expo/fetch` in `apps/mobile/lib/drive/drive-storage.ts`.
  **Passed the real-Drive contract on a physical iPhone** through `expo/fetch` (2026-09-11).
- **Google sign-in (2026-09-11).** `@react-native-google-signin/google-signin`, iOS client in the
  Google Cloud project, `drive.file` scope only. Account tab: connect / disconnect (revokes).
  Verified on device.
- **Backup and restore (2026-09-11).** `packages/storage/src/sync.ts` — `pushArchive` /
  `pullArchive`, key-free, tested against real archives over `FakeDrive`. On the phone: backup
  starts by itself on Verify after every import, "Back up now" in chat info, "Back up all" and
  "Download them" (restore) on the Account tab. A restored chat shows locked until its
  passphrase is entered. Copy that said "nothing is uploaded" / "no copy anywhere else" now
  says what stays true: nothing goes to *our* servers, and the Drive copy is the user's.
  **Not yet exercised on a device.**

- **Simplification (2026-09-11).** Owner's direction: minimal text, encryption opt-in.
  - Core: plain archives (format v2, `PLAIN_LAYOUT`, readable `chat.txt`); sealed stays v1 byte
    for byte, AAD pinned to "cvault/1" so every existing archive opens. Sync and the web viewer
    handle both.
  - One status per chat: On this phone → Uploading (progress bar) → Safe to delete → Deleted
    (`lib/ui/chat-status.ts`, tested). Chats back up by themselves when the list opens.
  - Media not in the export: one neutral sentence, "Learn more", "Don't remind me".
  - Every explanation moved to Settings → Help; screens trimmed to actions.

- **Off the phone, faster, named (2026-09-11).** After a backup, photos Drive verifiably holds
  are removed from the phone; screens read them back from Drive. Restores bring messages only.
  Backups make one request per small file, four in parallel, with no per-file lookups. Drive
  folders are named after the chat; "In your Google Drive" opens the folder. Share extension
  patched so WhatsApp no longer looks frozen after sharing. Home button on every inner screen.

- **No export size limit; photo previews (2026-09-11).** Exports are read one entry at a time
  from the file (the 150 MB cap is gone) and deleted after import. Each photo gets a small
  preview kept on the phone, so galleries stay instant after photos move to Drive.

- **Website: home page + shared chats only (2026-09-11, owner's direction).** No sign-in on the
  site — the goal is to send people to the app. "Share chat" in the app turns on Drive's
  "anyone with the link" for the chat's folder and sends `/s/<folderId>` (plus `#k=` for a
  protected chat); the site reads it straight from Drive with a public API key. "Stop sharing"
  removes the permission. Needs the API key, a Vercel deployment and `extra.webUrl` in the app.
  Release (non-dev) app build verified on device.

- **The shared chat reads like a chat, and can be kept (2026-09-12).** The web viewer got the
  app's chat shape — bubbles grouped into turns, day separators, a name and colour per speaker,
  opening at the last message, a jump-to-bottom button — plus chat info (participants, range,
  media, **size**), a dismissible "get the app" bar, and "keep this chat" into the reader's own
  Drive (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, owner's action: a Web OAuth client whose redirect URIs
  include `<site>/connect`). The app now shows each chat's size on its row and in chat info.
  **Not yet exercised with two real Google accounts.**

### Next — Phase 1, remaining

1. **Device check of backup and restore**: import a chat with Drive connected, watch Verify
   back it up, then remove it from the phone and restore it from the Account tab.
2. **Two phones on one Drive** is detected (`diverged`) but not resolved. Resolving it means
   pulling the other device's changes into a temporary copy and merging with `core` — needs the
   key, so it belongs with the unlock flow.
3. **Supabase account** — needs a Supabase project and a *Web* OAuth client ID (owner's
   action). Then the free-tier limit.

- **Chat icon (2026-09-11).** The library used to show the *smallest image in the chat* as its
  icon — usually a sticker — in the place people expect the real chat photo, which a WhatsApp
  export never contains. Now: initials by default; "Use as chat photo" on any photo in chat info
  or the media screen; "Remove photo" under the avatar in chat info. Stored as a pointer into the
  archive (`ArchivePreferences.chatPhotoSha256`), so no decrypted image is written anywhere.
  **Device-local for now** — it moves into the archive with the format v2 bump in Phase 1, so it
  syncs across devices and to group members. Choosing from the camera roll waits for the same
  bump, since it means adding an image the archive doesn't already hold.
