# @chatvault/api

Vercel Functions. Read the root `CLAUDE.md` first.

## Commands

```bash
pnpm dev         # vercel dev  (requires `npm i -g vercel`)
pnpm typecheck
```

## This service is small on purpose

Today it is a health endpoint and a format-version endpoint. It is growing into accounts,
subscriptions and sharing (`ACCOUNTS-AND-CLOUD.md`, on Supabase) — and it stays small, because
chats never live here: they live on the device and in the user's own Drive/Dropbox/iCloud.
Every endpoint added here is a chance to quietly break that.

**What this service must never do:**

- Receive or store a chat export, an archive, a chunk, a media file, or any decrypted content —
  not even encrypted. Chat bytes do not touch our servers.
- Receive an archive key, a passphrase, or anything derived from one
- Log or store a full archive URL — a Private share link's fragment carries the key, so a URL
  is a secret
- Fetch or proxy a user's cloud storage

**What it legitimately holds:**

- Accounts, subscription state (RevenueCat webhook), archive records, memberships and roles,
  share-link tokens. Never the content.
- **Standard-mode wrapping keys** — one per archive, encrypted under a master key kept outside
  the database, released only to members and valid link holders. The device unwraps the archive
  key with it; the server never sees the archive key. This is the most sensitive thing we store:
  every release is authorized per request and logged by account and archive id, never content.
- Public keys for Private-mode sharing. Private archives have no key here at all.
- Anonymous, aggregate telemetry — counts, never content, never per-chat identifiers.

If a feature seems to require the server to see chat content, the feature is wrong, not the
invariant. The usual fix is to do the work in the client.

## How to test this service

```bash
pnpm typecheck
pnpm dev          # vercel dev, then curl the endpoint
```

Because of what this service is *not* allowed to do, the most valuable test is a review
question rather than an assertion. For every endpoint you add, answer in the PR:

1. What is the most sensitive thing this endpoint can receive or return? If it receives chat
   content, an archive key, a passphrase or a full archive URL, the design is wrong. If it
   returns a Standard wrapping key, show the authorization check.
2. What does it log? Request URLs must never be logged for archive routes — the fragment
   carries the key, so a URL is a secret.
3. Could a caller enumerate archives with it?

Endpoints that return static facts (`/api/health`) can be asserted normally. Anything touching
share links needs a test proving that a request without the correct token returns 404 rather
than 403 — a 403 confirms the archive exists, which is itself a leak.

## Conventions

- Node runtime on Fluid Compute (the default). Do not reach for `runtime = "edge"`; it buys
  nothing here and costs Node API access.
- Configuration lives in `vercel.ts`, not `vercel.json`.
- Endpoints import shared constants from `@chatvault/core` — `FORMAT_VERSION` in particular
  must never be duplicated, or clients and server will disagree about what they can open.
