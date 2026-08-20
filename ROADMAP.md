# ChatVault — next steps

Where things stand and what to do next, ordered by risk rather than by convenience.

## State

| Layer | Status |
|---|---|
| `packages/core` | **Done for v1.** Parser, identity, merge, archive read/write, media pipeline, crypto. 125 tests. Parser and merge verified against a real export pair. |
| `packages/storage` | Interface + conformance suite + in-memory adapter. No real adapter yet. |
| `apps/mobile` | Shell. Two screens, no import, **no Share Extension**. A1/A2 ports (storage adapter, zip media source) written ahead of need — see Track A. |
| `apps/web` | **B0a done.** `/open`: pick a `.cvault` bundle, unlock by passphrase, virtualized RTL-correct viewer with media lightbox, client-side append-and-merge. No backend yet — see Track B. |
| `apps/api` | Health endpoint. Intentionally minimal. |

The logic is well ahead of the product. Everything below is about closing that gap.

---

## The one thing that could still invalidate the design

**Nothing has ever gone from WhatsApp into this app.** The Share Extension is the entire entry
point, it is unproven, and it has a hard ~120 MB memory ceiling. Every other risk in the
project is now retired; this one is not.

So the next step is a **spike, not a feature**:

### Step 0 — Prove the handoff  *(in progress)*

**Built and typechecking, waiting on a device:**

- `expo-share-intent` wired for the iOS Share Extension and Android `ACTION_SEND`, registered
  for `text/plain` and `application/zip`.
- The root layout routes a handoff to `app/import.tsx`, carrying a file **path**, never contents.
- `app/import.tsx` reports what arrived and — for a text export — parses it and shows message
  count, media count, participants, date range and dialect, to be checked against WhatsApp.
  A `.zip` is measured but deliberately **not read**: pulling a few-hundred-MB export into a JS
  string is the same crash as the extension's ceiling, only one step later.
- `eas.json` plus `build:dev:ios` / `build:dev:android`.

**The blocker: iOS cannot be built on Windows.** Xcode is macOS-only, so `pnpm ios` will never
run on this machine. The route is EAS Build (cloud macOS builders), which needs:

1. **Apple Developer Program, 99 USD/year** — a build carrying a Share Extension needs a
   provisioning profile to reach a physical iPhone; the free personal team only works through
   Xcode on a Mac.
2. An Expo account and `eas-cli`.

Android has neither requirement and is the cheap way to shake out the import pipeline — it just
cannot prove the iOS extension, which is the part actually at risk.

**Test it with a real chat exported *with media*, not a small text-only one.** A 5 KB export
will pass while a 200 MB one dies, and only the second case is representative.

*Gate: an export with media lands in the container and the host app reports its size. If the
extension is killed on large exports, stop and solve that before building anything on top.*

---

## Track A — Mobile, after Step 0 passes

In dependency order. A1–A3 are ports that core already declares; each is small and, apart from
A3, testable.

- **A1. `ExpoFileSystemStorageAdapter`** — **written** (`apps/mobile/lib/storage/`), typechecks,
  but **not yet proven**: it must pass `runStorageConformance` (`packages/storage/CLAUDE.md`),
  and that suite cannot run outside the Expo runtime because `File`/`Directory` are a native
  module — no device, no evidence. First thing to run once Step 0 has a build.
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

1. **Does Step 0 happen now?** Everything in Track A sits behind it, and it needs a physical
   iPhone with WhatsApp. If devices are a while away, Track B is the better use of time.
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
