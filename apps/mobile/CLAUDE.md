# @chatvault/mobile

Expo React Native, iOS and Android. This app owns the only entry point the product has: the
WhatsApp Share Sheet. Read the root `CLAUDE.md` first.

## Commands

```bash
pnpm start              # expo start --dev-client (Metro; needs a dev client installed)
pnpm typecheck
pnpm build:dev:ios      # EAS cloud build — the only iOS route from Windows, see below
pnpm build:dev:android  # EAS cloud build, or `pnpm android` with a local Android SDK
pnpm prebuild           # regenerate native projects after a config-plugin change
```

`pnpm ios` exists in `package.json` but **cannot run on this machine** — `expo run:ios`
shells out to Xcode, which is macOS-only.

**Expo Go will not work.** The share targets need native code, so this is a custom dev client
build. And the iOS Share Extension must be tested on a **physical device** — the simulator's
share sheet does not reliably surface extensions, and WhatsApp is not installed on it anyway.

## The Share Extension is the whole product

A user exports a chat in WhatsApp and taps our app in the share sheet. If that fails, nothing
else in the product is reachable. Build and verify it before anything else.

**The extension must only copy the file and exit.** iOS gives share extensions roughly 120 MB
of memory, and an export with media routinely exceeds that. So:

1. Extension receives the item, copies it into the **App Group** container
   (`group.app.chatvault.mobile`, set explicitly as
   `iosAppGroupIdentifier` in `app.json` — do not rely on the plugin default), and completes immediately.
2. It opens the host app, which does all parsing, hashing and encryption with a full memory
   budget.

Parsing inside the extension will appear to work on a small text-only export and then crash on
every real one. Do not do it.

On Android the equivalent is the `ACTION_SEND` intent filter in `app.json`, registered for
`text/plain` (export without media) and `application/zip` (with media). Android is far more
forgiving about memory, but keep the same split so both platforms share one code path.

## Building for a device from Windows

**You cannot build an iOS app on Windows.** Xcode is macOS-only, so `pnpm ios` will not work
on this machine. The route is EAS Build, which compiles on Expo's cloud macOS builders and
hands back an installable build.

Two prerequisites, both hard:

1. **Apple Developer Program membership** (99 USD/year). Installing a build with a Share
   Extension onto a physical iPhone needs a provisioning profile, and the free personal team
   only works through Xcode on a Mac — which is not available here.
2. **An Expo account** and `npm i -g eas-cli`.

```bash
cd apps/mobile
eas login
eas build:configure          # first time only
pnpm build:dev:ios           # cloud build, ~10-20 min; EAS walks you through signing
```

EAS prints an install URL and a QR code. Open it on the iPhone, install, trust the profile
under Settings > General > VPN & Device Management, then run `pnpm start` here and scan to
connect the dev client to Metro.

Android needs none of this — `pnpm build:dev:android` produces an APK you can install directly,
and it is the cheaper way to shake out import-pipeline bugs. It just cannot prove the iOS
Share Extension, which is the part actually at risk.

## How to test this app

Be precise about what each level actually proves, because the gap between them is where this
app's real risk lives.

| Level | Command | What it proves |
|---|---|---|
| Typecheck | `pnpm typecheck` | The code compiles. Nothing more. |
| Core logic | `pnpm --filter @chatvault/core test` | Parsing/merge/crypto are correct — but that is `core`, not this app |
| This app's pure-JS logic | `pnpm test` | `ZipMediaSource`'s filtering and lazy-read behavior — real evidence, but only for the one piece here that isn't a native module |
| Android device | `pnpm build:dev:android` | The import pipeline end to end — cheap, no Apple account. Also the first real chance to run `runStorageConformance` against `ExpoFileSystemStorageAdapter`, which cannot run any other way (see "Ports this app must implement") |
| **iPhone** | `pnpm build:dev:ios` + WhatsApp | **The only thing that proves the product works** |

**Never report a typecheck or a simulator run as evidence that an import works.** The share
sheet is the entire entry point, and it cannot be exercised without WhatsApp installed and a
real export shared into the app.

### The end-to-end check that counts

0. Install a dev client on the iPhone (see "Building for a device from Windows").
1. On the phone, WhatsApp → a chat → chat name → **Export chat** → *With media*.
2. Share to ChatVault. The extension should hand off immediately; if it stalls or dies on a
   large export, it is doing work it must not do (see the memory limit above).
3. On the Verify screen, compare the message count, date range and media count against the
   export itself. They must match exactly.
4. Reopen the archive from the Library and read it back.
5. Repeat the export *without media* and import that too. The archive must not grow by a
   second copy of every message — merge should absorb it. This is the same guarantee
   `groundtruth.test.ts` checks in `core`, and it is worth confirming on-device at least once,
   because the device is where the timezone offset and file handling can differ.

### Testing what you can without a device

Put logic in `core` or `@chatvault/storage` where it can be tested in Node, and keep the RN
layer thin enough to be obviously correct. The device adapter must pass
`runStorageConformance` — see `packages/storage/CLAUDE.md`. If you find yourself wanting to
unit-test a screen's parsing logic, that logic is in the wrong package.

## Screen flow

`Import → Progress → Verify → Destination → Guided delete → Library`

**The Verify screen is the trust moment** and deserves more care than anything else in the UI.
Before we suggest deleting anything, we show what was captured: message count, date range,
media count and total size, and a readable preview of the oldest and newest messages. A user
who does not believe this screen will never delete a chat, and the product's entire value
depends on them doing so.

**Guided delete never touches WhatsApp.** We cannot delete anything — no API exists (root
CLAUDE.md, invariant 1). The screen shows the user the steps and lets them confirm they did it.
Never write copy implying the app did the deleting.

## Ports this app must implement

Core declares capabilities structurally and each platform supplies them. Two land here, and
both have contracts that are easy to satisfy incorrectly:

**`MediaSource`** (`@chatvault/core`) — reads media out of the export zip. Implemented at
`lib/media/zip-media-source.ts` (`ZipMediaSource`), built on `fflate`.
`list()` must return **media candidates only**. A raw directory or zip listing also contains
`_chat.txt` and whatever the OS added (`.DS_Store`, `__MACOSX/`), and `linkMedia` reports
anything listed but unreferenced. Leave the transcript in and every archive will accuse itself
of holding an unreferenced file, forever. Core deliberately does not hardcode those names — the
filter is this app's job. `ZipMediaSource` does this filtering and is unit-tested for it
(`lib/media/zip-media-source.test.ts`, runs under `pnpm test` — pure JS, no native module, so
this one genuinely runs in CI, unlike the storage adapter below).

**Read entries lazily is not yet true here — this is a known gap, not an oversight.**
`linkMedia` hashes one blob at a time and drops the bytes, so peak memory stays at one file
*if* the source does not inflate the whole zip up front. `ZipMediaSource` currently takes the
whole export as one in-memory `Uint8Array` (`fflate.unzipSync`'s only mode), which is exactly
the failure the Share Extension's ceiling exists to avoid — see the long comment at the top of
`zip-media-source.ts` for what a real fix looks like (a central-directory parse over a
`FileHandle` plus per-entry inflate). `MAX_SAFE_ZIP_BYTES` (150 MB) makes it fail loudly
instead of getting the process killed silently, but that ceiling is a guess, not a measurement
— Step 0's device test is what would tell us the real number.

**`CryptoProvider`** — see Platform notes below.

**`StorageAdapter`** (`@chatvault/storage`) — implemented at
`lib/storage/expo-file-system-adapter.ts` (`ExpoFileSystemStorageAdapter`), built on SDK 57's
`File`/`Directory` API (the same one `app/import.tsx` uses). It must pass
`runStorageConformance` — and **cannot, yet, in CI**: `expo-file-system`'s `File`/`Directory`
are a native module, which does not exist under plain Node, so `runStorageConformance` can only
be pointed at this adapter from inside the Expo runtime (a device or simulator build), not from
`pnpm test` here. Typechecking it (which does pass) is not evidence it works — same rule as the
Share Extension. Running the conformance suite on-device is still owed before this adapter is
trusted with a real archive.

## Platform notes

- **Crypto.** Hermes has no `crypto.subtle`. Supply `createWebCryptoProvider` with a polyfill,
  or implement `CryptoProvider` over `react-native-quick-crypto`. Prefer Argon2id over the
  port's PBKDF2 default for passphrase wrapping — mobile has a native binding for it and the
  port exists so that swap is local.
- **Storage.** The device adapter lives here rather than in `@chatvault/storage`, because it
  needs `expo-file-system`. It must still pass `runStorageConformance`.
- **Keys.** The archive key goes in `expo-secure-store` (Keychain / Keystore) for convenience,
  wrapped by the user's passphrase for portability. A key that only exists in the keychain is
  a key the user loses with their phone — always keep the passphrase path working.
- **Large files.** Stream media from the export zip to storage; never read a whole zip into
  memory. The same discipline as the extension, for the same reason.
