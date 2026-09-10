# ChatVault — next steps

Where things stand and what to do next, ordered by risk rather than by convenience.

## State

| Layer | Status |
|---|---|
| `packages/core` | **Done for v1.** Parser, identity, merge, archive read/write, media pipeline, crypto. 125 tests. Parser and merge verified against a real export pair. |
| `packages/storage` | Interface + conformance suite + in-memory adapter. No real adapter yet. |
| `apps/mobile` | Runs on a physical iPhone. Two screens; the **Share Extension hands a file over successfully** (Step 0), but no import pipeline yet. A1/A2 ports (storage adapter, zip media source) written ahead of need — see Track A. |
| `apps/web` | **B0a done.** `/open`: pick a `.cvault` bundle, unlock by passphrase, virtualized RTL-correct viewer with media lightbox, client-side append-and-merge. No backend yet — see Track B. |
| `apps/api` | Health endpoint. Intentionally minimal. |

The logic is well ahead of the product. Everything below is about closing that gap.

---

## ~~The one thing that could still invalidate the design~~ — retired

The Share Extension was the entire entry point, unproven, with a hard ~120 MB memory ceiling.
**A real WhatsApp export has now gone from WhatsApp into this app.** The design stands.

### Step 0 — Prove the handoff  *(PASSED)*

**Proven on a physical iPhone (iOS 26.6, Route A / free personal-team signing):**

- The dev client builds locally with Xcode and installs on device. **No paid Apple Developer
  account was needed** — the earlier assumption that a Share Extension requires one was wrong;
  it only holds when there is no Mac to build from.
- The extension runs, writes into the App Group container, and reopens the host app.
- **A real chat exported *with media*, tens of MB, was shared into the app. The extension was
  not killed, and `app/import.tsx` reported the file had arrived.** That is the gate: the
  ~120 MB ceiling is not hit by an export of this size, because the extension copies and
  exits rather than doing work.

The headline risk of this project is therefore retired. What remains below is engineering, not
uncertainty about whether the product is reachable at all.

**Fixed along the way** (all committed, all with comments explaining why):

- `apps/mobile/metro.config.js` — did not exist. Metro could not resolve `core`'s NodeNext
  `.js` specifiers onto `.ts` files, so the bundle never built. Counterpart of the
  `extensionAlias` that `apps/web/next.config.ts` already had.
- `@expo/metro-runtime` was resolving to **4.0.1** against SDK 57's `^57.0.11`, killing the app
  at launch with an unstacked `TypeError: Object is not a function`. Pinned, along with
  `react-native-worklets`. See `apps/mobile/CLAUDE.md` → "Dependency pinning is load-bearing".
- `app/+native-intent.ts` — did not exist, so every share landed on expo-router's **"Unmatched
  Route"** screen even though the file had arrived. Plus an anchor route so Import is never a
  dead end.

**Loose ends, none of them blocking Track A:**

1. **The ceiling is proven at tens of MB, not at the worst case.** WhatsApp caps a with-media
   export around 10,000 messages, which can run to several hundred MB. The extension's design
   (copy and exit) should be size-independent, but that is reasoning, not measurement — worth
   one test with the largest export available before trusting it in front of users.
2. Confirm on device that a `.zip` shows **size and a note only, no parse numbers** — the code
   path does this, but it was not read off the screen.
3. The `+native-intent.ts` fix was verified by typecheck and a simulator launch, **not yet by a
   real share on device** — the successful handoff above predates it and needed a manual Back.

*Gate met: an export with media landed in the container and the host app reported it, with the
extension not killed.*

---

## Track A — Mobile *(unblocked; Step 0 passed)*

In dependency order. A1–A3 are ports that core already declares; each is small and, apart from
A3, testable.

> **Start here: A1.** Not because it is the biggest item, but because a working device build
> now exists for the first time and A1 is the only thing that has been *waiting on exactly
> that*. `runStorageConformance` cannot run in Node, in CI, or in Expo Go — it needs the Expo
> runtime, which until Step 0 passed we did not have. Everything else in Track A can be
> written without a device; A1 can only be *proven* with one, so run it while the build is
> fresh and known-good. It also de-risks A4 — the import pipeline writes through this adapter,
> and finding out then that the port is wrong means debugging two things at once.

- **A1. `ExpoFileSystemStorageAdapter`** — **written** (`apps/mobile/lib/storage/`), typechecks,
  but **not yet proven**: it must pass `runStorageConformance` (`packages/storage/CLAUDE.md`),
  and that suite cannot run outside the Expo runtime because `File`/`Directory` are a native
  module — no device, no evidence. **The blocker is now gone.** Getting the suite to run means
  giving it somewhere to execute inside the app — a dev-only screen or a route that runs it and
  renders the results is enough; it does not need to be pretty, and it should not ship.
- **A2. `MediaSource` over the export zip** — **written and unit-tested**
  (`apps/mobile/lib/media/zip-media-source.ts`, 6 passing tests), but with a known gap: it
  loads the whole zip into memory (`fflate.unzipSync`'s only mode) rather than reading entries
  lazily, which is exactly the failure mode the Share Extension's ceiling exists to avoid. Capped
  at 150 MB so it fails loudly instead of getting killed; the real fix is a central-directory
  parse over a `FileHandle` with per-entry inflate, deliberately not attempted yet.
- **A3. `CryptoProvider` for Hermes** — WebCrypto polyfill, or `react-native-quick-crypto`.
  When Argon2id lands, branch on `KdfParams.algorithm` *inside the provider*; do not remove the
  `UnsupportedKdfError` guard.
- **A4. Import pipeline** — `parseExport` → `linkMedia` → `ArchiveWriter.write`. Mostly wiring;
  core does the work.
- **A5. Verify screen** — the trust moment. Message count, date range, media count, **and an
  honest count of media that is NOT in the archive** (`mediaStats.notArchivedCount`). That
  number is what the user loses if they delete the chat, and hiding it would be the single
  most damaging thing this product could do.
- **A6. Guided delete** — instructions and confirmation only. The app never deletes anything.
- **A7. Library + reader** — `ArchiveReader`, RTL-correct message list.

*Gate: export a real chat, import it, confirm the Verify numbers against the export itself,
delete the chat in WhatsApp, and read the archive back. Then re-export the same chat later and
import again — the archive must absorb it, not double.*

---

## Track B — Web viewer

**B0a shipped.** Went with bundle-open over waiting for Drive (B0b): no backend, no cloud
adapter, and it delivers the group-sharing story immediately — B0b is still the plan once
Track C lands, at which point `/open` gains a sibling that fetches by URL instead of a file
picker.

- **`/open`** (`apps/web/app/open/`) — pick a `.cvault` file, unlock it with the passphrase
  from `ArchiveHeader.keyWrapping` (no fragment involved; there is no link, just a file someone
  handed you), then view it. `lib/open-archive.ts`, `lib/unwrap-key.ts`.
- **`lib/bundle-storage.ts`** — the `.cvault` file *is* a zip of exactly what
  `ArchiveStoragePort` holds (`header.json`, `manifest.json.enc`, `chunks/*`, `media/*`,
  `index.json.enc`), unzipped into memory with `fflate` and re-zipped for the "Download updated
  bundle" button. This is where the zip format lives — `core` never sees it, only the port.
- **Message list** — `react-virtuoso` (variable-height rows; a fixed-row virtualizer doesn't
  fit a chat with text next to photos next to system notices). RTL correctness is CSS, not a
  language heuristic: `unicodeBidi: "plaintext"` on each message body lets the browser pick
  direction per-message from its own first strong character.
- **Media** — `MediaAttachment.tsx` decrypts a blob lazily on scroll-into-view via
  `reader.readMedia`, object-URLs it, revokes on unmount. `Lightbox.tsx` for images.
- **Append-and-merge** — `lib/read-export.ts` (unzips a raw WhatsApp export, filters
  `_chat.txt`/OS debris the same way `apps/mobile/CLAUDE.md` documents `MediaSource.list()`
  must) → `lib/build-import.ts` (`linkMedia` + stamps `attachment.sha256` back onto parsed
  messages — `parseExport` never fills this in) → `ArchiveWriter.append`. Runs entirely in the
  tab; nothing is ever sent anywhere.

**Verified against the real Hebrew export pair** (not a synthetic fixture): appended the real
127-message with-media export onto a 5-message throwaway archive in the actual built app.
Result: 132 total, added-count matched exactly, zero console errors, zero network requests for
the entire operation (checked in DevTools), RTL Hebrew text rendered correctly interleaved with
LTR English, omitted-media messages showed "not captured in this archive" honestly, and a real
decrypted sticker rendered and opened correctly in the lightbox.

One rough edge found and left as-is for now: `/open`'s file input loses browser focus after a
file is picked via the automated `file_upload` path, so `type` has to click the passphrase
field by coordinate rather than by ref to land text in it. Unconfirmed whether this affects a
real human dragging a file in normally — worth a manual check before calling B0a fully done.

*Gate met: open an archive, confirm it renders, confirm in DevTools that no request — ever —
contains the key or any archive content.*

---

## Track C — Cloud destinations

- **C1. Google Drive adapter** — the only destination reachable from mobile, web and Android
  alike. Do this one first regardless of what users say they want.
- **C2. iCloud (iOS-only), Dropbox, OneDrive.** Set `capabilities().webReadable` honestly and
  surface it in the destination picker: an archive in iCloud can never be opened by the web
  viewer, and the user must learn that *before* sharing a link, not after.
- **C3. Backend grows** into share-link metadata and per-recipient key wrapping — still never
  seeing plaintext.

---

## Track D — Logged debt (none blocking)

All documented in `packages/core/CLAUDE.md`:

- Filename matching is byte-exact; NFD/NFC could split one file across `missing` *and*
  `unreferenced` (the co-occurrence is the tell).
- `MediaRef` has no back-link to its messages.
- Append decrypts every chunk to decide reuse.
- Cross-timezone merge needs `ImportSource.tzOffsetMinutes` set correctly; no auto-detection.
- Sender aliases (contact name vs phone number) need the manifest alias map populated by UI.

---

## Decisions that need you

1. ~~Does Step 0 happen now?~~ **Passed, on a Mac with a physical iPhone**, with a real
   with-media export. Track A is unblocked.
2. ~~Web viewer: bundle-open (B0a) or wait for Drive (B0b)?~~ **Decided: B0a, and it's built.**
3. **Product name.** `ChatVault` is a placeholder sitting in bundle ids, the manifest and the
   UI. Cheap to change now, annoying later.
4. **Open-source the archive format and parser?** Recommended — for a product whose pitch is
   "trust us enough to delete your originals", a published format is the strongest possible
   trust signal, and the parser is the part most valuable to have others test.

## The product question no amount of code answers

The thesis is that a verified archive makes people comfortable deleting a chat. **Nobody has
tested that.** Once Step 0 and A5 exist, the cheapest real experiment is: put it in front of
ten people with genuinely full phones, and count how many actually delete the chat afterwards.
If they archive and *don't* delete, the storage pitch is wrong and the product is really "the
chat archive you own" — which changes what to build next far more than any item above.
