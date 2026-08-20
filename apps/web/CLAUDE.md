# @chatvault/web

Next.js App Router on Vercel. Two jobs: let a group member **read** an archive someone shared,
and let them **append** their own export of the same chat. Read the root `CLAUDE.md` first.

## Commands

```bash
pnpm dev         # next dev
pnpm build
pnpm typecheck
```

## The rule that governs this whole app

**The key lives in the URL fragment and must never leave the browser.**

Archive links are `/a/<archiveId>#k=<base64url key>`. Browsers do not send the fragment to the
server, do not include it in `Referer`, and do not log it. That single fact is what lets this
site display a chat it cannot itself decrypt.

Consequences, all load-bearing:

- **Decryption is client-only.** Anything touching a key is a Client Component. A Server
  Component cannot see the fragment; if you find yourself reaching for it on the server, the
  component is in the wrong place.
- **Never serialize a URL with its fragment.** Not to analytics, not to an error reporter, not
  into `fetch`, not into a log line. `lib/fragment-key.ts` exports `withoutKey()` — use it at
  every boundary.
- **No third-party script that reads `location`.** Session-replay and most analytics tools
  capture full URLs by default and would exfiltrate the key wholesale.
- `metadata.referrer` is `no-referrer` in `app/layout.tsx`. Do not relax it.

## How to test this app

```bash
pnpm dev
pnpm build        # catches Server/Client Component mistakes that dev mode tolerates
pnpm typecheck
```

**The check that matters most is a privacy check, and it is manual.** Open an archive URL with
its key in the fragment, then in DevTools → Network, confirm that no request — document,
RSC payload, image, analytics beacon — contains the key or the fragment. Do this after any
change that touches routing, layout, metadata, or adds a dependency. A leak here silently
destroys the product's central promise, and nothing else in the stack will catch it.

Also confirm by hand:

- The viewer renders with JavaScript enabled and shows a clear, non-alarming message with it
  disabled — decryption is client-side by design, so a blank page is a bug.
- A wrong or truncated key produces `MissingKeyError`'s message, not a crash or a blank screen.
- A long archive scrolls smoothly. If it stutters, the list is not virtualized.
- Append-and-merge: drop in a second export of the same chat and confirm the message count
  grows by the *new* messages only. `summarize()` from `@chatvault/core` gives you the numbers.

**Never test with a real chat export committed to the repo.** Keep test archives outside it.

## Structure

| Path | Role |
|---|---|
| `app/page.tsx` | Landing + plain-language explanation of the trust model, links to `/open` |
| `app/open/page.tsx` | **The viewer (B0a: bundle-open, no backend).** File picker → passphrase unlock → virtualized message list → append panel. State machine over `pick` / `unlocking` / `unlock-error` / `viewing`, all in one Client Component per the rule above. |
| `app/open/MessageList.tsx` | `react-virtuoso`-backed virtualized list. Variable row heights, so not a fixed-row virtualizer — a chat mixes one-line texts, photos and system notices. |
| `app/open/MessageRow.tsx` | One message. `unicodeBidi: "plaintext"` on the body is what makes RTL correct without a language heuristic — the browser picks direction per-message from its own first strong character. |
| `app/open/MediaAttachment.tsx` | Decrypts a blob lazily, object-URLs it, revokes on unmount. |
| `app/open/Lightbox.tsx` | Full-screen image view on click. |
| `app/open/AppendPanel.tsx` | Client-side append-and-merge (B3). |
| `lib/fragment-key.ts` | Reading and stripping the key from `location.hash`. **Not yet wired to a route** — there is no `/a/[archiveId]#k=...` link today because that needs a backend or Drive (B0b, Track C). Exists for when that lands. |
| `lib/bundle-storage.ts` | `.cvault` file ⇄ `ArchiveStoragePort`. The zip format lives here; `core` never sees it. |
| `lib/open-archive.ts` | File + passphrase → `{ storage, reader, key }`. |
| `lib/unwrap-key.ts` | Passphrase → archive key via `ArchiveHeader.keyWrapping`. Mirrors the pattern in `packages/core/src/archive/reader.test.ts`. |
| `lib/read-export.ts` | Raw WhatsApp export (`.zip` or `.txt`) → transcript text + `InMemoryMediaSource`, filtering `_chat.txt`/OS debris. |
| `lib/build-import.ts` | `ParseResult` + `MediaSource` → a `MessageBatch` with `attachment.sha256` filled in, plus the `MediaBlob[]` to seal. `parseExport` never fills in the hash itself — this is where it happens. |
| `lib/mime.ts`, `lib/base64.ts` | Small format helpers. |

**Dependencies added for the viewer:** `fflate` (zip, both directions — bundle and raw export)
and `react-virtuoso` (the message list). Neither exists in `core`; both are web-only.

**`next.config.ts` needs `webpack.resolve.extensionAlias`.** `core`'s internal imports use
explicit `.js` extensions on `.ts` files (NodeNext-style, so it runs unmodified under Node's
ESM loader) — webpack does not resolve that on its own and needs to be told a `.js` specifier
may resolve to a `.ts` file. Without it, `next build` fails with "Module not found" on every
`core` import, even though `next dev` and `tsc --noEmit` both stay silent about it. Do not
remove this if `core`'s import style ever seems safe to "clean up" — it isn't a workaround for
a bug in `core`, it's what keeps `core` isomorphic (root CLAUDE.md invariant 3).

## How the viewer works (built, B0a)

- Decrypt with `createWebCryptoProvider(crypto.subtle, ...)` from `@chatvault/core`. The web
  client needs no crypto dependency — AES-256-GCM was chosen precisely so WebCrypto suffices.
- No fragment key in this flow: B0a has no link, just a `.cvault` file, so `readHeader` gets the
  KDF params and `unwrapArchiveKey` turns a typed passphrase into the archive key. The whole of
  `lib/fragment-key.ts` is for B0b, later.
- `ArchiveReader.readAll()` is used rather than lazy per-chunk fetches — fine at the message
  counts this has been tested against, but if a very large archive turns out to stutter on
  open, chunk-lazy loading via `manifest.chunks[]`'s `firstTs`/`lastTs` is the fix, not
  reaching for a bigger virtualizer.
- `AppendPanel` needs the raw archive key to build a fresh `ArchiveWriter` and reopen a reader
  after appending — `OpenedArchive.key` carries it alongside the reader for exactly that reason
  (`ArchiveReader` deliberately keeps it private). Never sent anywhere; lives only in this tab.

## How append-and-merge works (built, B3)

`lib/read-export.ts` is the port implementation for the uploaded zip — the same job
`apps/mobile/CLAUDE.md` describes for `MediaSource` on mobile. `list()` (here, the filtered
entries handed to `InMemoryMediaSource`) must return media candidates **only**: filter out
`_chat.txt` and OS debris (`.DS_Store`, `__MACOSX/`, `Thumbs.db`) before handing entries to
core, or `linkMedia` will report them as unreferenced files forever. Core does not hardcode
those names on purpose; the filter belongs to whoever knows the platform.

Parse and merge **in the browser**, with `parseExport` and `mergeBatches` from
`@chatvault/core` — the same code the mobile app runs. The uploaded export must never be sent
to a server; that would break invariant 2 for the one flow where it is most tempting to cheat.

Show the contributor what their export added — today that's a before/after `messageCount` diff
off the returned `Manifest`, which is the whole incentive to contribute. `summarize()` exists
for a richer per-contributor breakdown (how many of *your* messages were already known vs.
genuinely new) and would be the natural next step here, not yet wired up.
