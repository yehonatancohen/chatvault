# @chatvault/api

Vercel Functions. Read the root `CLAUDE.md` first.

## Commands

```bash
pnpm dev         # vercel dev  (requires `npm i -g vercel`)
pnpm typecheck
```

## This service is small on purpose

v1 is a health endpoint and a format-version endpoint. That is not a placeholder for a "real"
backend that arrives later — the smallness *is* the architecture. The product's promise is that
the archive lives where the user chooses and that we cannot read it, and every endpoint added
here is a chance to quietly break that.

**What this service must never do:**

- Receive a chat export, an archive, a chunk, or any decrypted content
- Receive an archive key, a passphrase, or anything derived from one
- Log or store a full archive URL — the fragment carries the key, so a URL is a secret
- Proxy a user's cloud storage, which would put plaintext in transit through us

**What it legitimately grows into (v1.5):**

- Share-link metadata: which archive id exists, who was invited. Never the content.
- Invitations and per-recipient key wrapping, where the server holds only ciphertext it has no
  key for.
- Anonymous, aggregate telemetry — counts, never content, never per-chat identifiers.

If a feature seems to require the server to see plaintext, the feature is wrong, not the
invariant. The usual fix is to do the work in the client and hand the server only ciphertext.

## How to test this service

```bash
pnpm typecheck
pnpm dev          # vercel dev, then curl the endpoint
```

Because of what this service is *not* allowed to do, the most valuable test is a review
question rather than an assertion. For every endpoint you add, answer in the PR:

1. What is the most sensitive thing this endpoint can receive? If the answer involves chat
   content, a key, or a full archive URL, the design is wrong.
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
