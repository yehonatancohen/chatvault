# Accounts, subscriptions and cloud storage — plan

Status: **Phase 1 in progress** — Google Drive storage, sign-in, backup and restore are built (see "Done" at the bottom); accounts and Standard mode are next. Written 2026-09-11
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
| Encryption | **Not end-to-end by default.** End-to-end is an option chosen when exporting a chat, with a **recovery key**. |
| Who needs an account | The app, always. The website only to store — **viewing a chat shared by link works signed out.** |
| Destinations | Drive, Dropbox and iCloud are available on **every tier**, free included. |
| Backend | **Supabase** (Postgres + auth). |
| Chat icon | Initials by default; the user can pick a photo from the chat. *(Built.)* |

What the subscription pays for is **the service** — the app, merging group members' exports,
sharing, the viewer — not storage. That's also why the numbers work at any size: a user's media
costs us nothing, because it lands in their Drive, not ours. There is no storage cap to decide.

---

## 1. Two modes: Standard and Private

"Not end-to-end" is still **encrypted** — archive files in the user's Drive are sealed either way.
A plain-text chat sitting in someone's Drive, shared by an "anyone with the link" URL, is one
forwarded link away from being public, and it's everyone in the group's messages, not just our
customer's. Encryption costs the user nothing they can see. What changes between modes is
**who can unlock the key**:

| | **Standard** (default) | **Private** (opt-in at export) |
|---|---|---|
| What unlocks it | Being signed in as a member (or holding a share link) | Passphrase, or the recovery key |
| Forgot passphrase / lost phone | Sign in on the new phone; everything opens | Recovery key, or it's gone — **say this plainly at setup** |
| Share link | Revocable — we stop handing out the key | Key in the URL fragment; revoking stops *new* data only |
| Could Boydem read it? | Technically: we hold the wrapping key, and could fetch the files if we broke our own rule. So **never call it end-to-end** | No — we hold no key at all |

**How Standard works without the chat ever touching us.** Each Standard archive has a small
*wrapping key* stored in our database. The archive key in `header.json` is sealed under it. When
a member (or a link holder) opens the archive, their device asks our API for the wrapping key,
gets it only if they're allowed, and unwraps the archive key **on the device**. Our server never
sees the archive key, a message, or a media file, and never fetches anything from the user's
storage. Revoking someone = we stop giving them the wrapping key.

**The archive format barely changes.** Both modes write today's `.cvault` layout. The difference
is a new `KeyWrapping` variant in `header.json` ("wrapped by server key #id") beside today's
passphrase wrapping, plus a second wrapping under the recovery key for Private. That's an on-disk
change → **`FORMAT_VERSION` 2 + migration** (invariant 4). Every v1 archive is a passphrase
archive, i.e. Private, so the migration is a relabel.

Switching modes:
- Private → Standard: unlock on the device, add the server wrapping. Cheap.
- Standard → Private: needs a fresh archive key and a full re-encrypt + re-upload, because the
  old key could be recovered by anyone who held the wrapping key. Offer it, showing size and
  time first.

## 2. Accounts and backend

- **Sign-in:** Sign in with Apple and Google. Apple requires Sign in with Apple when Google is
  offered, and it's the smoothest option on iPhone anyway. Email magic link on the web.
- **Supabase** holds: accounts, archive records (id, owner, mode, which destination, member
  list), memberships and roles, share-link tokens, Standard wrapping keys, subscription state.
  Nothing else. It's plain Postgres underneath, so it moves to any Postgres host if outgrown.
- **Standard wrapping keys are the one sensitive thing we store.** Keep them encrypted under a
  master key that lives outside the database (a Vercel/KMS secret), so a database dump alone
  opens nothing. Every key release is logged by *who* and *which archive*, never by content.
- **`apps/api`** stays small: auth, archives/memberships, key release, RevenueCat webhook. It
  never receives a chat, a chunk, a media file, an archive key or a passphrase.
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
  record, sharing, and Standard key release all go through our API.

## 4. Sharing and access

Roles per archive: **owner** (billing, delete), **contributor** (can add their own export of the
same chat), **viewer** (read only).

- **Signed-out viewers on the website are a main path, not an edge case.** A group member opens a
  link, reads the chat in the browser with no account, and ends on "Add your own export of this
  chat" → sign up. That is probably the main way new users arrive.
- **How a viewer gets the bytes:** from the owner's storage, directly into the browser — never
  through us. For Drive and Dropbox that means the archive folder is shared by link in the
  owner's account, and the viewer's browser downloads the sealed files from there.
  **To verify before building:** that Drive (`files.get?alt=media` with an API key) and Dropbox
  shared links can be fetched from a browser (CORS) for a signed-out visitor.
- **iCloud archives can't be opened from the website** — Apple offers no way in. The share
  button on an iCloud archive has to say so, or offer to move it to Drive/Dropbox.
- **Standard:** the link carries a token; the API checks it and releases the wrapping key.
  **Private:** today's design — key in the URL fragment, never sent to the server.
- **Private sharing between accounts:** each account gets a keypair when it first uses Private
  mode, and sharing wraps the archive key to the recipient's public key.
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
| 1 | **Accounts + Google Drive, Standard mode** | Sign in, chats sync to your Drive, open on a second device. Format v2. The "no account" screen and copy are rewritten. Free tier enforced at 5. |
| 2 | **Subscriptions** | RevenueCat, the two paid tiers, paywall on the 6th chat, restore purchases. |
| 3 | **Sharing** | Share links, the signed-out web viewer, roles, contributors. |
| 4 | **Private mode** | Opt-in at export, passphrase + recovery key, keypairs. |
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
3. **Existing local archives** on testers' phones: sync as Private (they already have a
   passphrase) and offer to switch to Standard. Assumed.

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

### Next — Phase 1, remaining

1. **Device check of backup and restore**: import a chat with Drive connected, watch Verify
   back it up, then remove it from the phone and restore it from the Account tab.
2. **Two phones on one Drive** is detected (`diverged`) but not resolved. Resolving it means
   pulling the other device's changes into a temporary copy and merging with `core` — needs the
   key, so it belongs with the unlock flow.
3. **Supabase account** — needs a Supabase project and a *Web* OAuth client ID (owner's
   action). Then Standard mode (format v2, server-held wrapping key) and the free-tier limit.

- **Chat icon (2026-09-11).** The library used to show the *smallest image in the chat* as its
  icon — usually a sticker — in the place people expect the real chat photo, which a WhatsApp
  export never contains. Now: initials by default; "Use as chat photo" on any photo in chat info
  or the media screen; "Remove photo" under the avatar in chat info. Stored as a pointer into the
  archive (`ArchivePreferences.chatPhotoSha256`), so no decrypted image is written anywhere.
  **Device-local for now** — it moves into the archive with the format v2 bump in Phase 1, so it
  syncs across devices and to group members. Choosing from the camera roll waits for the same
  bump, since it means adding an image the archive doesn't already hold.
