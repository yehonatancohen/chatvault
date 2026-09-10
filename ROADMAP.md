# ChatVault — next steps

Where things stand and what to do next, ordered by risk rather than by convenience.

## State

| Layer | Status |
|---|---|
| `packages/core` | **Done for v1.** Parser, identity, merge, archive read/write, media pipeline, crypto. 125 tests. Parser and merge verified against a real export pair. |
| `packages/storage` | Interface + contract suite (runnable under vitest *and* inside a device runtime) + in-memory adapter. No cloud adapter yet. |
| `apps/mobile` | **Track A built end to end** — share → import → verify → guided delete → library → reader, with Hermes crypto and a device-proven storage adapter. 87 tests. Awaits one real-export run on a phone. |
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

> ~~**Start here: A1.**~~ *Done — and it did exactly what the note predicted, finding a bug
> that no green CI run could have. Kept below for the reasoning.* Not because it is the
> biggest item, but because a working device build
> now exists for the first time and A1 is the only thing that has been *waiting on exactly
> that*. `runStorageConformance` cannot run in Node, in CI, or in Expo Go — it needs the Expo
> runtime, which until Step 0 passed we did not have. Everything else in Track A can be
> written without a device; A1 can only be *proven* with one, so run it while the build is
> fresh and known-good. It also de-risks A4 — the import pipeline writes through this adapter,
> and finding out then that the port is wrong means debugging two things at once.

- **A1. `ExpoFileSystemStorageAdapter`** — **passed on device.** The contract moved out of the
  vitest file into `packages/storage/src/contract.ts` so it could run inside the Expo runtime;
  `apps/mobile/app/dev-storage.tsx` runs it there. The first real run found two bugs in
  `putStream`, both from `expo-file-system`'s `writableStream()` opening `FileMode.WriteOnly`:
  it does not create the file (so every streamed write to a new object failed), and it does not
  truncate (so a shorter rewrite would have left the tail of the old ciphertext behind —
  silent, and fatal to a media blob). Fixed with `create({ overwrite: true })`, and the second
  bug now has a contract case of its own.

- **A2. `MediaSource` over the export zip** — unchanged, plus `readTranscript()`: `list()`
  hides the transcript by contract, so the parser needed a way to it. Still loads the whole zip
  into memory (`fflate.unzipSync`'s only mode), still capped at 150 MB, still owed a
  central-directory reader over a `FileHandle`. **This is now the largest known gap in the
  mobile app.**

- **A3. `CryptoProvider` for Hermes** — **built** (`lib/crypto/noble-provider.ts`).
  AES-256-GCM and PBKDF2 in pure JS (`@noble`), SHA-256 and the CSPRNG native via expo-crypto.
  Pure JS was chosen *for testability*: it runs under Node, so it is checked against WebCrypto
  itself, in both directions — the one mobile port whose correctness does not depend on a
  device. `lib/crypto/vectors.ts` carries fixed answers generated by WebCrypto, asserted in CI
  and again on the phone, which is what makes "an archive written here opens in a browser" a
  checked claim. Argon2id still refused, guard intact. **Unmeasured: sealing throughput on a
  device.** Media is the bulk of an archive and this is JS-bound.

- **A4. Import pipeline** — **built.** `lib/import/run-import.ts` (every port injected, so it
  runs under Node), `device-import.ts` (the filesystem/Keychain half, deliberately logic-free),
  `match.ts` (which archive an export belongs to — decided on message identity, never on the
  chat title), `build-import.ts` (stamps `attachment.sha256`, which `parseExport` never fills
  in). The Verify numbers are read back *out of the archive* after writing rather than
  remembered from the write.

- **A5. Verify screen** — **built** (`app/verify.tsx`). `notArchivedCount` is rendered as
  prominently as the good news, and the "everything was saved" case is rendered explicitly too,
  so that a section which only appears with bad news never teaches users to skim it.

- **A6. Guided delete** — **built** (`app/delete-guide.tsx`). Per-platform instructions, a
  confirmation the user gives us, and nothing that touches WhatsApp.

- **A7. Library + reader** — **built**, and since reworked into a chat rather than a list:
  inverted so the newest message is at the bottom, day separators, runs from one sender grouped
  under a single name, tap-to-open media with pinch zoom, and a chat-info screen (people, media
  gap, which exports the archive was built from). A locked archive — key not in the Keychain,
  after a restore or on another device — is a first-class state the passphrase opens. Media
  renders from a `data:` URI rather than a decrypted cache file, so no plaintext is ever
  written outside the archive.

**What is proven, and what is not.** `pnpm -r test` is 225 tests (125 core, 13 storage,
87 mobile), `pnpm -r typecheck` is clean, and a full `expo export` iOS bundle builds. The app
was built with `xcodebuild`, installed on a simulator, launched, and rendered the library
screen. **None of that is evidence about a real import**, which needs a device, WhatsApp, and
the share sheet. Two things are owed, in this order:

1. **Tap "Dev: run the device checks"** — storage contract plus the crypto/import pipeline
   against Hermes and the real filesystem. Watch the PBKDF2 timing case: it fails over 4 s and
   warns over 1.5 s, and that number decides whether the KDF stays in JS.
2. **The Track A gate below**, with a real export.

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
