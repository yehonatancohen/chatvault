# ChatVault — root guidance

Monorepo for an app that turns a WhatsApp chat export into a verified, portable archive the
user owns (encrypted when they choose) — so that deleting the original chat becomes a safe act.

Read this file before working anywhere in the repo. Each subproject has its own `CLAUDE.md`
with stack-specific detail; this one holds the rules that apply everywhere.

## The product in one paragraph

The user exports a chat from WhatsApp and shares it into our app. We parse it, verify it,
(if they asked) encrypt it on-device, and save it on the phone and in their own Drive. We then *prove* what
we captured and walk the user through deleting the chat in WhatsApp themselves. Group members
can later append their own exports of the same chat; the archive is the union of everyone's,
which reaches further back than any single export can.

## Non-negotiable invariants

1. **We never delete anything from WhatsApp.** There is no API for it and we must never imply
   otherwise, in code, copy, or telemetry. The app archives and then *guides*. Any UI string
   claiming we free storage directly is a bug.
2. **Chats never live on our servers.** Parsing happens on the device. Messages and media are
   stored only on the device and in storage the user owns (Google Drive, Dropbox, iCloud) —
   never on Boydem's servers, in any form. The backend holds accounts, subscriptions and
   sharing records, and **no archive keys**: it never receives chat content, a key or a
   passphrase, and never fetches, proxies or caches a user's storage.
   **Encryption is opt-in.** By default a chat is saved as plain, readable files (format v2) on
   the phone and in the user's Drive. A chat the user protects with a passphrase is sealed
   end-to-end (format v1) and opens only with that passphrase; its share links carry the key in
   the URL fragment, which browsers do not transmit. Copy must never call an unprotected chat
   encrypted. (Decided 2026-09-11; see `ACCOUNTS-AND-CLOUD.md`.)
3. **`packages/core` is isomorphic.** No `node:*` imports, no React Native modules, no DOM
   globals. Platform capabilities (crypto, filesystem, zip) enter through injected ports
   defined in `core`. It runs identically in Node tests, Hermes, and the browser.
4. **The archive format is versioned.** Any change to the on-disk shape bumps
   `FORMAT_VERSION` in `packages/core/src/archive/format.ts` and ships a migration. Archives
   outlive app versions — a user may open a two-year-old vault.
5. **Merge is idempotent and commutative.** Importing the same export twice changes nothing;
   importing A then B equals B then A. This is enforced by property tests, not by convention.
6. **Never commit real chat data.** Exports contain other people's personal data. Fixtures are
   hand-authored or anonymized. See `.gitignore`.
7. **We only ever consume WhatsApp's own official export.** Never automate the WhatsApp app,
   never read its databases, never scrape. That line is what keeps this legitimate.

Current state and what to build next: **`ROADMAP.md`**. Accounts, subscription and cloud
storage: **`ACCOUNTS-AND-CLOUD.md`**.

## Layout

| Path | What it is |
|---|---|
| `packages/core` | Parser, archive format, merge, crypto ports. The shared brain. Test hardest. |
| `packages/storage` | `StorageAdapter` interface + per-destination adapters |
| `apps/mobile` | Expo React Native, iOS + Android. Owns the Share Extension — the app's only entry point. |
| `apps/web` | Next.js on Vercel. Read-only viewer + client-side append-and-merge. |
| `apps/api` | Vercel Functions + Supabase. Accounts, subscriptions, sharing records. Never stores or proxies chat content, and holds no keys. |

## Conventions

- TypeScript strict everywhere, extending `tsconfig.base.json`. No `any` in `core`.
- Vitest for tests. Test files sit beside their source as `*.test.ts`.
- Errors in `core` are typed result objects, not thrown strings — parsing partially-corrupt
  exports is normal and must degrade gracefully rather than abort.
- `pnpm build` / `test` / `typecheck` at the root run everything through Turborepo.

## How to verify your work

```bash
pnpm -r test         # every package
pnpm -r typecheck    # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
pnpm --filter @chatvault/web build
```

Per-layer detail lives in each subproject's `CLAUDE.md`; the parts worth knowing repo-wide:

- **Changing the parser, identity, or merge?** Run the ground-truth check against a real export
  pair (`packages/core/CLAUDE.md` → "How to test this package"). Green unit tests are not
  sufficient evidence here — every parser bug in this project so far passed a green suite,
  because the fixtures and the code shared an assumption.
- **Changing merge or identity?** The merged count of a with-media / without-media pair of the
  same chat must equal one export's message count, with zero unmatched. Anything else means
  the archive silently duplicates or drops messages.
- **Changing the archive format?** Bump `FORMAT_VERSION` and ship a migration (invariant 4).
- **Mobile changes cannot be verified from CI or a simulator.** The Share Extension needs a
  physical device with WhatsApp installed. Say so plainly rather than reporting a typecheck as
  if it were a test.
- **Touching mobile dependencies? A green install proves nothing.** Several Expo/RN packages
  are reached only through unpinned peer deps and this workspace has `autoInstallPeers`, so
  pnpm picks versions freely and picks wrong — silently. `pnpm install`, `typecheck` and a
  Metro bundle all succeed, and the app then dies at launch with an unstacked
  `TypeError: Object is not a function`. Run `pnpm exec expo install --check`, treat "unmet
  peer" warnings as errors, and read `apps/mobile/CLAUDE.md` → "Dependency pinning is
  load-bearing here" before removing anything from `apps/mobile/package.json` that looks
  unused. Two entries there are pins, imported by nothing.
- **Never verify by adding a real chat export to the repo.** Point the ground-truth test at a
  directory outside it.

## Where the difficulty actually is

Not the crypto. The two genuinely hard parts:

- **The parser.** WhatsApp's export text is locale-shaped and riddled with invisible bidi
  marks (`U+200E`, `U+200F`). Hebrew/RTL exports are the common failure case. Every
  downstream guarantee rests on parsing correctly, so it gets a fixture corpus.
- **The iOS Share Extension.** It is the app's entire entry point, it has a hard ~120 MB
  memory limit, and it cannot be tested in Expo Go. It must only copy the incoming file into
  the App Group container and exit; all work happens in the main app.

## What a real export actually looks like

Established by diffing one real Hebrew iOS chat exported twice from the same phone, once with
media and once without. Every item here contradicted an earlier guess, so treat them as facts
to build on rather than assumptions to revisit:

1. **A caption is inline, before the marker, on the same line** — `Sender: caption ‎<marker>`,
   marker last, preceded by an LRM. It is *not* a continuation line.
2. **iOS writes omitted markers in English even in a Hebrew chat**: `image omitted`,
   `video omitted`, `sticker omitted`.
3. **A with-media export still contains omitted markers** for media no longer on the device —
   6 of 21 media messages in the pair. "Omitted" is not a synonym for "exported without media".
4. **Two exports of the same chat disagree about the seconds**, on 8 of 127 timestamps. This is
   the evidence behind minute-precision message identity.
5. **In a 1:1 chat the encryption notice carries a sender name**, so system messages are not
   identifiable by the absence of a sender.
6. Media files sit flat beside `_chat.txt`, named like
   `00000043-PHOTO-2025-03-14-20-10-34.jpg`.

Verified end to end: both exports parse to 127 messages with zero issues, all 15 attachments
resolve to files present in the folder, and merging the pair yields **127 messages with zero
unmatched** — where naive concatenation would have produced 254.

Re-run that check any time with `groundtruth.test.ts`; see `packages/core/CLAUDE.md`.
