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
  first in the cloud phase.
- **Streaming matters for media.** `put`/`get` take a whole `Uint8Array`; a 40 MB video
  buffered whole is how a mobile process gets killed. Implement `putStream`/`getStream` and set
  `capabilities().streaming` for any adapter that will carry media.
- **Never delete without an explicit user action.** `remove` exists for cleaning up a failed
  write. Nothing in this package should ever garbage-collect an archive on its own.
