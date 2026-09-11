# @chatvault/mobile

Expo React Native, iOS and Android. This app owns the only entry point the product has: the
WhatsApp Share Sheet. Read the root `CLAUDE.md` first.

## Commands

```bash
pnpm start              # expo start --dev-client (Metro; needs a dev client installed)
pnpm typecheck
pnpm ios --device       # local Xcode build onto a plugged-in iPhone (macOS only)
pnpm build:dev:ios      # EAS cloud build — the route when there is no Mac, see below
pnpm build:dev:android  # EAS cloud build, or `pnpm android` with a local Android SDK
pnpm prebuild           # regenerate native projects after a config-plugin change
```

**`pnpm prebuild` runs `expo prebuild --clean`, which regenerates `ios/` from scratch and
wipes the signing you set by hand in Xcode.** After a dependency change that only moves native
pod versions, run `cd ios && pod install` instead — it picks up the new pods and leaves the
Xcode project, and therefore the signing, alone.

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

### The extension reopens the app with a signal URL, not a file

Verified on device. When the iOS extension finishes, it reopens the host app with a deep link
of the shape `chatvault://dataUrl=chatvaultShareKey`. That URL is a *signal* — it carries no
file and matches no route. Left alone, expo-router falls straight through to its **"Unmatched
Route"** screen, which looks exactly like the share failing even though the handoff worked and
the file is already sitting in the App Group container.

`app/+native-intent.ts` is what prevents that: expo-router runs `redirectSystemPath` before
matching, and it rewrites that URL to `/import`. `ShareIntentRouter` in `_layout.tsx` then
replaces the bare screen with one carrying the file's path and metadata, which only
`useShareIntentContext` can supply. Both halves are required — the redirect alone gets you to
Import with no file, and the router alone never runs because you are on the 404.

**`unstable_settings.initialRouteName = "index"` in `_layout.tsx` is also load-bearing.** A
share cold-starts the app directly onto `/import`, so without an anchor route there is nothing
beneath it and the user is stranded on a screen with no way back. `import.tsx` additionally
falls back to `router.replace("/")` when `canGoBack()` is false, so the screen can never be a
dead end.

## Building for a device

**On a Mac (the proven route).** `expo run:ios` shells out to Xcode. Free "personal team"
signing is enough for a dev client carrying a Share Extension — no paid Apple account needed.
Done once and it worked; the full first-time walkthrough is in the repo root's `MAC-SETUP.md`.
The short version:

```bash
cd apps/mobile
pnpm prebuild --platform ios   # first time only; generates ios/ and runs pod install
open ios/ChatVault.xcworkspace # sign BOTH targets by hand: ChatVault and ChatVaultImport
pnpm ios --device              # or hit Run in Xcode
pnpm start                     # Metro, once the app is installed
```

**If `pnpm ios --device` builds and then sits on `Connecting to: iPhone` indefinitely**, the
build is fine and the phone probably is too — Expo's own installer is what hangs (seen on
iOS 26 for 20+ minutes). Ctrl-C and install with Apple's tool instead; it takes seconds:

```bash
xcrun devicectl list devices        # the phone should show "connected"
xcrun devicectl device install app --device "iPhone" \
  ~/Library/Developer/Xcode/DerivedData/ChatVault-*/Build/Products/Debug-iphoneos/ChatVault.app
pnpm start                          # Metro, if the Ctrl-C took it down
```

Both targets need a team and the App Group `group.app.chatvault.mobile`. The extension is a
separate target and Xcode will not sign it for you. After install, trust the developer profile
on the phone under Settings > General > VPN & Device Management.

**Without a Mac**, the route is EAS Build (Expo's cloud macOS builders), which needs an Expo
account, `npm i -g eas-cli`, and an **Apple Developer Program membership (99 USD/year)** —
the free personal team only works through Xcode on a Mac.

```bash
eas login && eas build:configure && pnpm build:dev:ios
```

Android needs none of this — `pnpm build:dev:android` produces an APK you can install directly,
and it is the cheaper way to shake out import-pipeline bugs. It just cannot prove the iOS
Share Extension, which is the part actually at risk.

## Dependency pinning is load-bearing here — do not "tidy" it

`apps/mobile/package.json` lists two dependencies **nothing in this app imports**:
`@expo/metro-runtime` and `react-native-worklets`. They are there purely to pin versions, and
removing them because they look unused will break the app at launch. The comment block in that
file says why; the mechanism is worth understanding once:

Several Expo/RN packages are reached only through **unpinned peer dependencies**, and this
workspace runs with `autoInstallPeers`. pnpm is therefore free to choose versions, it chooses
wrong, and **nothing warns you** — `pnpm install` succeeds, `pnpm typecheck` passes, Metro
bundles cleanly. The app then dies on launch with:

```
[runtime not ready]: TypeError: Object is not a function
```

and no stack, no module name, no file. `@expo/metro-runtime` had resolved to **4.0.1** against
SDK 57's required `^57.0.11`; its `messageSocket.native.ts` opens a dev websocket at module
scope during startup, so the mismatch detonated inside `InitializeCore`, before LogBox existed
to symbolicate anything.

Two habits that follow:

- **Run `pnpm exec expo install --check` after any dependency change**, and treat pnpm's
  "unmet peer" warnings as errors rather than noise. Every one of them was true.
- **Re-check the pins on every SDK bump.** They are correct for SDK 57 and nothing else.

### Expo module signatures are not what the TypeScript says

Two of these have bitten already, both found only on a device, both invisible to `tsc`:

- **`Crypto.digest(algorithm, data)` must be handed a TypedArray, never an `ArrayBuffer`.** Its
  declared parameter type is `BufferSource`, which includes `ArrayBuffer`; the native side
  rejects one with `NotTypedArrayException: Given argument is not an instance of TypedArray`,
  wrapped in `ArgumentCastException: The 3rd argument cannot be cast to type TypedArray`.
  Passing `bytes.buffer` instead of `bytes` broke SHA-256 — and therefore every archive write,
  the whole import, and five device checks at once.
- **`File.writableStream()` opens `FileMode.WriteOnly`,** which neither creates the file nor
  truncates it. See `lib/storage/expo-file-system-adapter.ts`.

The lesson both times: **an expo-modules signature describes the JS wrapper, not the native
contract.** When a call crosses into Swift, the device checks are the only thing that will tell
you the truth — which is the argument for keeping them exhaustive.

### After `pod install`: run `scripts/fix-prebuilt-flavors.sh` before building

**Every prebuilt iOS framework comes in a debug and a release flavour** — React Native core
(`RCT_USE_PREBUILT_RNCORE`), its dependencies bundle, Hermes, and Expo's prebuilt modules
(`ExpoModulesCore`, `ExpoFileSystem`, `ExpoFont`, `ExpoModulesWorklets`). A build phase per
framework swaps flavours, remembering the last one in a `.last_build_configuration` marker.
**`pod install` can leave the release flavours in place with those markers missing or saying
"debug"**, and the swap phases trust the markers and skip. A Debug build then mixes debug code
compiled from source with release frameworks. Found on 2026-09-11 after adding Google sign-in,
in two stages:

1. **Link error**: `Undefined symbols for architecture arm64` — `facebook::react::Sealable`,
   `ShadowNode::getDebugName`, `RCTPackagerConnection` — referenced from gesture-handler,
   Reanimated, screens and the dev launcher alike. These exist only in debug React Native.
   (Expo's output truncates the symbol list; the `SwiftUICore` line beside it is a harmless
   warning.)
2. **Instant crash at launch** once only React core was swapped: `EXC_BAD_ACCESS` in
   `facebook::react::Props::Props()` called from `ExpoModulesCore` while registering native
   views. Debug and release disagree on the size of `Props`, so a debug React writing into an
   object laid out by release `ExpoModulesCore` corrupts memory. Crash reports:
   `xcrun devicectl device info files --device <id> --domain-type systemCrashLogs`.

The fix is one script, which claims the opposite flavour in each marker and then runs that
framework's own swap script:

```bash
apps/mobile/scripts/fix-prebuilt-flavors.sh          # Debug (default) — or pass Release
```

**Run it after every `pod install`, then build.** To check a framework by hand, compare its
`ios-arm64` binary with the one inside its `*-debug.tar.gz` in `Pods/*-artifacts/` or
`Pods/<Module>/artifacts/`; the release React core is ~12 MB, the debug one ~68 MB.

### Debugging a launch crash: use the simulator, even though it cannot test this app

The simulator cannot prove anything about the Share Extension, and the table below is still
the rule. But for a crash that happens *before the app renders*, it is the only tractable
tool, because a physical device gives you one line of text and a human reading a screen aloud:

```bash
xcrun simctl boot <udid> && open -a Simulator
pnpm exec expo run:ios --device <simulator-udid>
xcrun simctl launch <udid> app.chatvault.mobile
xcrun simctl io <udid> screenshot /tmp/redbox.png   # the red box, stack frames and all
```

Screenshotting the red box is what produced the real stack frame
(`createWebSocketConnection`), which mapped straight to the offending module in the bundle.
Fetching the exact bundle the app requests (`/apps/mobile/node_modules/expo-router/entry.bundle`,
the path Metro logs) and reading around the reported line number is the rest of the technique —
Metro dev bundles carry a `verboseName` per module, so a line number names a package.

Do not run the bundle under Node hoping for a stack: it throws somewhere plausible but wrong
(a missing native module, not the real fault) and sends you chasing the wrong package.

## How to test this app

Be precise about what each level actually proves, because the gap between them is where this
app's real risk lives.

| Level | Command | What it proves |
|---|---|---|
| Typecheck | `pnpm typecheck` | The code compiles. Nothing more. |
| Core logic | `pnpm --filter @chatvault/core test` | Parsing/merge/crypto are correct — but that is `core`, not this app |
| This app's pure-JS logic | `pnpm test` | 87 tests: the **whole import pipeline** (`lib/import`, every port injected), the crypto provider against WebCrypto, key wrapping across both providers, `ZipMediaSource`, formatting. Real evidence — and none of it is about Hermes, the Keychain or the filesystem |
| Any device or simulator | the **device checks** screen (`app/dev-storage.tsx`) | Two suites `pnpm test` cannot reach: the storage contract against the real filesystem adapter, and the crypto + import pipeline against Hermes, native SHA-256 and a real directory — including that this phone's AES-GCM and PBKDF2 match the bytes a browser produces |
| Device + network + a throwaway Google account | **Run against Google Drive** on the same screen, with a pasted `drive.file` token | The storage contract against real Drive through `expo/fetch` (`lib/drive/drive-storage.ts`) — in particular that the HTTP stack hands back Drive's `308 Resume Incomplete` during chunked uploads rather than treating it as a redirect. No other test can tell you that |
| Android device | `pnpm build:dev:android` | The import pipeline end to end — cheap, no Apple account |
| **iPhone** | `pnpm build:dev:ios` + WhatsApp | **The only thing that proves the product works** |

**Never report a typecheck or a simulator run as evidence that an import works.** The share
sheet is the entire entry point, and it cannot be exercised without WhatsApp installed and a
real export shared into the app.

### The end-to-end check that counts

0. Install a dev client on the iPhone (see "Building for a device").
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
layer thin enough to be obviously correct. Where a native module makes that impossible, the
answer is a dev screen that runs the same suite inside the runtime rather than a weaker test —
`app/dev-storage.tsx` is the worked example, and `packages/storage/CLAUDE.md` explains the
two-runner split that makes it possible. If you find yourself wanting to unit-test a screen's
parsing logic, that logic is in the wrong package.

## Screen flow

`Share → Import → Verify → Guided delete → Library → Archive reader` (built; Destination
belongs to Track C and does not exist yet — v1 writes to the device only).

| Route | What it is |
|---|---|
| `app/index.tsx` | Library. Lists archives by opening each one; refreshes on focus. Empty state is the important half — it is where a user who has not exported yet is told how. |
| `app/import.tsx` | Two-phase. `prepareImport` reads/parses/matches and writes nothing, *then* the screen knows whether to ask for a new passphrase, an existing one, or neither. |
| `app/verify.tsx` | The trust moment. See below. |
| `app/delete-guide.tsx` | Instructions and a confirmation the user gives *us*. Deletes nothing. |
| `app/archive/[id]/index.tsx` | The chat. **Inverted list** — newest at the bottom, which is where a conversation ends. Unlocks by passphrase when the key is not in the Keychain. |
| `app/archive/[id]/info.tsx` | Chat info: media preview, participants (collapsed past 8, expanded in place), which exports the archive was built from, and **where the archive is stored**. Where a member picks which participant is themselves. |
| `app/archive/[id]/media.tsx` | The gallery. Virtualized rows, because each tile decrypts its own blob on mount. |
| `components/archive/` | `MessageBubble`, `Lightbox`, `MediaGrid`, `ChatAvatar`, `useArchive`. **Components live outside `app/`** — expo-router treats every file under `app/` as a route, so a component there becomes a navigable screen. |
| `app/dev-storage.tsx` | Dev-only device checks. Both suites; never ships. |

**Where the import logic lives, and why it is not in the screens.** `lib/import/run-import.ts`
takes every port as a parameter, so the entire pipeline runs under Node in
`run-import.test.ts` against `MemoryStorageAdapter` and WebCrypto. `lib/import/device-import.ts`
is the device half — filesystem, Keychain, native CSPRNG — and deliberately holds no logic of
its own: matching is `chooseTarget`, writing is `runImport`, wrapping is `wrapArchiveKey`, and
all three are tested. Keep it that way. Logic that migrates into a screen becomes untestable.

**Two decisions worth knowing before changing the import flow:**

- **Which archive an export belongs to is decided by message identity, not by chat title**
  (`lib/import/match.ts`). Titles come from the export filename and differ per member and per
  locale; ids are content-derived and stable, which is what merge already rests on. The
  threshold exists because a *single* shared id is a plausible coincidence and welding two
  chats into one archive is permanent.
- **The Verify screen's numbers are read back out of the archive after writing**, not
  remembered from the write. It costs a full read and it is what makes the screen's claim
  ("this is safely archived") a statement about the file rather than about our intentions.
- **The media-gap wording is computed, not written inline** (`lib/ui/media-explanation.ts`,
  tested). "Not all media is saved" is the most alarming sentence this app says, at the moment
  a user is deciding whether to delete their only other copy, and the two causes behind it need
  opposite advice: media WhatsApp had already lost is gone, while media absent because the
  export was made *without* media is sitting in WhatsApp untouched. The counts alone cannot
  tell those apart, which is why `PreparedImport.hadMedia` is threaded through to Verify.
- **The reader is a chat, not a list** (`lib/ui/chat.ts`, tested): day separators, runs from one
  sender grouped under a single name, newest at the bottom. Grouping breaks after five minutes
  even for the same speaker — stacking a morning and an evening message under one name implies
  they were said together, which is a lie about a record someone is checking against memory.
- **A WhatsApp export contains no avatars and no thumbnails**, so a chat shows coloured initials
  unless the user picks one of its photos ("Use as chat photo" in the lightbox; `findChatPhoto`).
  **Never pick one automatically** — an earlier version showed the smallest image, which was
  usually a sticker, in the exact place people expect the chat's real icon. The format has no
  preview line and no blob→message back-link either, which is why `readLibrary` reads messages
  to build a row; if that gets slow, the fix is a summary sealed into the archive at write time,
  not a cache outside it.
- **An export never says which participant is "you", or what the chat's photo is**, so
  `lib/archive/preferences.ts` stores both per archive, outside the archive directory: display
  preferences, not archive content, and the format must stay free of device-local state. The
  photo is a content address into the archive, never image bytes — nothing decrypted is written
  out. Use `updatePreferences`, which merges; a whole-object write from one screen erases the
  other's choice.

**Minimal text is a product rule (owner, 2026-09-11).** Screens carry actions and the facts
needed to act; every explanation lives in Settings → Help (`app/help.tsx`, `help.*` strings).
Before adding a sentence to a screen, put it in Help instead.

- **Encryption is opt-in.** A new chat is saved plain unless "Protect with a passphrase" is on at
  import (default from Settings). `keyForArchive` returns `undefined` (plain, no key needed),
  a key, or `null` (protected, key not here → "locked").
- **Each chat has one status** (`lib/ui/chat-status.ts`, tested): On this phone → Uploading
  (progress bar) → Safe to delete → Deleted. "Safe" requires Drive to hold the *latest* version;
  "Deleted" is only ever the user's own confirmation on the delete guide. Opening the chat list
  backs up whatever is behind (`backupPending`).
- **Media not in the export is one neutral sentence** (`MediaNote`) with "Learn more" and
  "Don't remind me" — never a red warning. The count is always the real `notArchivedCount`.
- **The Verify numbers are still read back out of the archive**, not remembered from the write.

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
`File`/`Directory` API (the same one `app/import.tsx` uses). It must pass the storage contract,
and **cannot do so in CI**: `expo-file-system`'s `File`/`Directory` are a native module that
does not exist under plain Node, so `pnpm test` here proves nothing about this adapter and
`pnpm typecheck` proves only that it compiles — same rule as the Share Extension.

**`app/dev-storage.tsx` is where it gets run instead.** It calls `runStorageContract` — the
same cases `pnpm test` runs against `MemoryStorageAdapter`, one fresh cache directory per case
— and renders every result. Dev-only: `index.tsx` links to it under `__DEV__`, so it never
reaches a user. Open it from the library screen, tap **Run the contract**, and read the
results off the phone.

Run it after any change to the adapter, and before trusting it with a real archive. A green
`pnpm test` says nothing here; this screen is the only evidence that exists.

## Platform notes

- **Crypto.** Hermes has no `crypto.subtle`, so `createWebCryptoProvider` is unusable here.
  `lib/crypto/noble-provider.ts` is the replacement: **AES-256-GCM and PBKDF2 in pure JS**
  (`@noble/ciphers`, `@noble/hashes`), with SHA-256 and the CSPRNG injected from expo-crypto
  (`expo-crypto-provider.ts`).

  Pure JS was chosen over `react-native-quick-crypto` **for testability, not for convenience**.
  It runs under Node, so `noble-provider.test.ts` checks it against WebCrypto itself — sealing
  with one and opening with the other, in both directions. The failure that prevents is
  unrecoverable: if mobile and web disagree by one parameter, an archive written on the phone
  cannot be opened in the browser, and the user finds out long after deleting the chat.

  The device half of that claim is `lib/crypto/vectors.ts`: fixed AES-GCM, PBKDF2 and SHA-256
  answers generated by WebCrypto, asserted in CI *and* by the dev screen on the phone. Matching
  them on a device is what proves Hermes produces the bytes a browser reads. **Do not
  regenerate those constants to make a test pass** — a mismatch is the thing they exist to catch.

  The cost is throughput: sealing is JS-bound, and media is the bulk of an archive. Unmeasured
  on a device. If it proves too slow, the swap to a native binding is one file, and this
  provider stays as the reference the tests run against. Argon2id is still declarable and still
  refused (`UnsupportedKdfError`) — a pure-JS memory-hard KDF is not honest at real parameters.
- **Storage.** The device adapter lives here rather than in `@chatvault/storage`, because it
  needs `expo-file-system`. It must still pass `runStorageConformance`.
- **Keys.** The archive key goes in `expo-secure-store` (Keychain / Keystore) for convenience,
  wrapped by the user's passphrase for portability. A key that only exists in the keychain is
  a key the user loses with their phone — always keep the passphrase path working.
- **Large files.** Stream media from the export zip to storage; never read a whole zip into
  memory. The same discipline as the extension, for the same reason.
