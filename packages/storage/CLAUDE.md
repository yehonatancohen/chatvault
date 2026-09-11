# @chatvault/storage

Where archives get written. One interface, one adapter per destination. Read the root
`CLAUDE.md` first.

## Commands

```bash
pnpm test        # runs the conformance suite against every adapter
pnpm typecheck
```

## How to test this package

There is one test strategy here and it is not negotiable: **every adapter runs the same
conformance suite**. Do not hand-write per-adapter tests instead — the whole point is that a
Drive adapter and the in-memory one are proven to behave identically, so that code written
against one cannot break on the other.

The suite covers the things that differ quietly between backends and surface months later
inside a user's archive: buffer aliasing, overwrite semantics (including a shrinking write that
must not leave a tail behind), prefix listing, recursive listing under `""`, binary safety,
empty objects, missing-object behaviour, idempotent delete, and — for any adapter declaring
`capabilities().streaming` — that `putStream`/`getStream` exist and round-trip.

**The cases live in `src/contract.ts`, not in a test file, and there are two runners:**

| Runner | Where it runs | Used by |
|---|---|---|
| `runStorageConformance` (`src/conformance.ts`) | vitest, Node | `pnpm test`, every adapter's `*.test.ts` |
| `runStorageContract` (`src/contract.ts`) | anywhere; returns results, never throws | `apps/mobile/app/dev-storage.tsx`, on a device |

That split exists because `ExpoFileSystemStorageAdapter` **cannot run under vitest at all** —
`File`/`Directory` are a native module with no Node implementation — and an adapter that cannot
run the suite is an adapter nobody has checked. Both runners walk the same array, so adding a
case still adds it everywhere.

Two rules follow: `contract.ts` may not import a test framework, `node:*`, or a DOM global (it
runs under Hermes, same constraint as `core`), and **`src/index.ts` must never re-export
`runStorageConformance`** — that entry point is bundled by Metro, and pulling vitest into a
Hermes bundle kills the app at launch.

For a cloud adapter, run it twice — against a fake/mock HTTP layer in CI, and manually at least
once against the real service with a real account, since quota, auth expiry and eventual
consistency are exactly what a mock will not reproduce. When you do the real run, use a
throwaway account, not the account holding your own archives.

## The shape of this package

`StorageAdapter` (`src/adapter.ts`) is the only thing callers know about. v1 ships
`MemoryStorageAdapter` for tests; the device adapter lives in `apps/mobile` because it needs
Expo's filesystem, and cloud adapters land here as they are built.

**Adapters only ever see ciphertext.** They receive sealed bytes and a path. An adapter that
needs to understand what it is storing is a design error — encryption happens in `core` before
anything reaches this layer.

## Adding an adapter

1. Implement `StorageAdapter`.
2. Add `runStorageConformance("YourAdapter", () => new YourAdapter(...))` in its test file.
   This is not optional. `src/contract.ts` is the executable contract, and it catches the
   differences — buffer aliasing, missing-object behaviour, binary safety — that otherwise
   surface months later inside a user's archive. If the adapter needs a runtime vitest cannot
   provide, drive `runStorageContract` from there instead (see the mobile dev screen); "it does
   not fit the runner" is not a reason to skip the contract.
3. Set `capabilities()` honestly, especially `webReadable`.

## Per-destination notes

- **`webReadable` is not a formality.** iCloud has no cross-platform API: an archive written to
  a user's iCloud Drive is reachable from that iPhone and nowhere else — not from Android, not
  from the web viewer, not from their own laptop browser. The UI must say so at the moment the
  user picks the destination, not after they have shared a link that will never open.
- **Google Drive is the only destination that serves all three clients**, which is why it is
  first in the cloud phase. Built: `src/google-drive/` — `DriveClient` (auth, retry, backoff
  over an injected `fetch`), `GoogleDriveStorageAdapter`, `folders.ts` (`My Drive/Boydem/
  <archiveId>/`, found by `appProperties` tag so a renamed folder is not lost), and `FakeDrive`,
  the strict in-memory Drive the contract runs against in CI. The real-Drive run is
  `google-drive.live.test.ts` (`GOOGLE_DRIVE_TEST_TOKEN=… pnpm test`) and, on a phone, the dev
  screen — both through `runLiveDriveContract`. Things worth knowing before changing it:
  - Scope is `drive.file` only. Anything broader is a "restricted" scope with a paid annual
    Google security assessment, and would let us see files that are none of our business.
  - Drive names are not unique. Reads take the newest, `list` reports a path once, `remove`
    trashes every copy. Folder lookups take the *oldest*, so every device picks the same one.
  - `remove` moves to the Drive trash rather than deleting — recoverable for 30 days.
  - Streamed uploads use resumable sessions; after a dropped connection the adapter asks the
    session what it committed instead of re-sending blindly (`sendChunk`). `FakeDrive` rejects
    overlapping or gapped ranges, which is what keeps that honest.
  - No `URLSearchParams`, no `TextEncoder`: Hermes support for both is partial. Request JSON is
    ASCII-escaped (`asciiJson`) so it becomes bytes without an encoder.
- **Sync (`src/sync.ts`) copies archives between storages without the key.** `pushArchive`
  (phone → Drive) and `pullArchive` (Drive → a new phone). Media is write-once, so present means
  done; everything else can be rewritten, so a ledger of ciphertext hashes decides what to
  re-send. Push writes the manifest last; pull writes the header last (the app lists an archive
  only once its header exists). A Drive copy changed by another device is reported as
  `diverged` and never overwritten. Tested against real core archives over `FakeDrive`
  (`sync.test.ts`) — including an append that rewrites a chunk, which is the case a
  "copy what's missing" sync gets silently wrong.
- **Streaming matters for media.** `put`/`get` take a whole `Uint8Array`; a 40 MB video
  buffered whole is how a mobile process gets killed. Implement `putStream`/`getStream` and set
  `capabilities().streaming` for any adapter that will carry media.
- **Never delete without an explicit user action — with one deliberate exception.** `remove`
  exists for cleaning up a failed write, and nothing here garbage-collects an archive on its own.
  The exception is `offloadMedia` (owner's decision, 2026-09-11: keeping chats on the phone
  "would ruin the whole idea"): after a backup it removes *photos from the phone* that Drive
  verifiably holds — listed there and reported at exactly the same size. Nothing is ever removed
  from Drive, messages never leave the phone, and a copy Drive holds at the wrong size is
  re-uploaded (`sizesDiffer`) rather than trusted. Tested in `sync.test.ts`.
- **Media goes up through the platform's native uploader when there is one** (`putFile`, from a
  `FileUploader` given to `DriveClient`; on iOS a background URLSession). Streaming photos
  through JS and `fetch` capped a 150 MB chat at ~0.2 MB/s on a good connection and stopped the
  moment the app was backgrounded. Now sync opens a resumable session per file and hands every
  file to the platform at once (`onQueued`), then waits for all of them before the manifest.
  Progress is reported in bytes (`bytesDone`/`bytesTotal`). A resumable session URL needs no
  bearer token — which is what lets a background upload outlive the app's token — and
  `FakeDrive` behaves the same way. Tested in `sync.test.ts` → "native uploads".
- **Backups are request-light on purpose.** One listing up front lets the Drive adapter answer
  every "is it there?" from memory (`completeDirs`); files up to 5 MB go whole in one request;
  media uploads run four at a time. `sync.test.ts` → "speed" pins the request count down.
