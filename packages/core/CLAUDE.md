# @chatvault/core

The shared brain: parser, message identity, merge, archive format, crypto ports. Every client
depends on this and nothing depends on the clients. Read the root `CLAUDE.md` first.

## Commands

```bash
pnpm test          # vitest run
pnpm test:watch
pnpm typecheck     # tsc --noEmit, strict + noUncheckedIndexedAccess

# run one area
pnpm vitest run src/parser
pnpm vitest run src/merge.test.ts

# ground truth against a REAL export on your machine (see "How to test" below)
CVAULT_EXPORT_A=/tmp/with-media CVAULT_EXPORT_B=/tmp/without-media pnpm vitest run groundtruth
```

## How to test this package

Four layers, in ascending order of how much they can tell you.

**1. Example tests** (`parse.test.ts`) — one dialect or shape per test. Cheap, readable,
and the weakest evidence: they only ever confirm what the author already believed.

**2. Property tests** (`merge.test.ts`) — the merge laws, checked over generated input with
`fast-check`. Idempotency, commutativity, associativity, and "no message is ever lost". These
catch real bugs because they do not depend on anyone imagining the right example. When you
touch `merge.ts` or `identity.ts`, these are the tests that matter.

**3. Regression tests** (`regression.test.ts`, `real-export.test.ts`) — one test per bug that
actually happened, and fixtures modelled on a real export pair rather than invented.

**4. Ground truth** (`groundtruth.test.ts`) — the parser run against an actual WhatsApp export
sitting on your disk, with expectations derived *from the file itself*: does every source line
end up accounted for, does every attachment name a file that exists in the folder, is every
file in the folder referenced by some message, do two exports of the same chat merge to one
archive instead of two? Skipped unless `CVAULT_EXPORT_A` is set.

**This fourth layer is the one that finds things.** Every parser bug in this project so far
was a case where the code and its tests shared the same wrong assumption, and each was caught
only by comparing against a real file. If you change the parser, get a real export and run it.

To produce a test pair: in WhatsApp, export one chat twice — once *with* media, once
*without* — unzip both somewhere outside the repo, and point the two env vars at them. Delete
them when you are done; they contain other people's personal data and must never enter the
repo (root `CLAUDE.md`, invariant 6).

### Verifying a change to identity or merge

A change here can silently duplicate or drop messages in an archive that already exists. Before
and after your change, run the ground-truth pair and compare the merged count. It must equal
the message count of a single export, and `unmatched` must be zero.

## The one rule

**Isomorphic only.** No `node:*`, no `react-native`, no DOM globals, and no DOM *lib* either —
`tsconfig.json` deliberately sets `"lib": ["ES2022"]`. When a platform capability is needed,
declare a structural interface and take it as a parameter. `SubtleCryptoLike` in
`src/crypto/ports.ts` is the worked example: it describes the five WebCrypto methods we use,
and Node, browsers and RN all satisfy it structurally without core importing anything.

Test files may import `node:crypto` — they only ever run under Node, and checking our SHA-256
against the platform's is worth more than purity in a test.

## Map

| File | Responsibility |
|---|---|
| `parser/text.ts` | Invisible-character normalization. Runs before any regex sees the text. |
| `parser/datetime.ts` | Tokenize, infer field order/clock per file, resolve, validate |
| `parser/markers.ts` | Attachment / omitted / deleted / system classification |
| `parser/regression.test.ts` | Guards the three defects fixtures alone could not catch |
| `parser/parse.ts` | Two-pass parser, continuation folding, media ordinals |
| `identity.ts` | `computeMessageId` — the primitive merge rests on |
| `merge.ts` | Idempotent, commutative, associative union |
| `crypto/sha256.ts` | Sync SHA-256 for short strings only |
| `crypto/ports.ts` | `CryptoProvider` + WebCrypto implementation |
| `archive/format.ts` | `.cvault` layout, manifest shape, AAD binding, version guard |
| `archive/writer.ts` | Chunking, sealing, media dedup, manifest/index writes, append |
| `archive/reader.ts` | Version guard, lazy chunk reads, integrity checks, media |
| `archive/jsonl.ts` | Canonical chunk encoding — canonicality is load-bearing for append |
| `media/source.ts` | `MediaSource` port + `InMemoryMediaSource` |
| `media/link.ts` | Filename → content-addressed blob, missing/unreferenced reporting |
| `media/stats.ts` | The numbers the Verify screen shows before a user deletes anything |

## Things that will bite you

**Never write an invisible character as a literal.** `parser/text.ts` builds its character
classes from numeric code points via `esc()`. A literal U+200E in a regex is invisible in
every editor and diff, and one stray copy-paste silently breaks Hebrew parsing. Fixtures
inject them through named constants (`LRM`, `RLM`, `NNBSP`, `ZWJ`, `ZWNJ`) for the same reason.

**Not every invisible character is noise.** ZWJ (U+200D) and ZWNJ (U+200C) are *content* — ZWJ
binds emoji sequences (strip it and 👨‍👩‍👧‍👦 becomes four separate people) and ZWNJ is
orthographic in Persian and Arabic. Only LRM/RLM are the marks WhatsApp injects. The stripping
range deliberately stops short of 0x200C–0x200D; do not "tidy" it into a wider range.

**Media markers are a line TAIL, and the caption comes before them.** Verified against a real
iOS export pair. A captioned photo is one line — `Sender: caption <LRM><marker>` — with the
marker last:

```
Sender: תראה מה מצאתי ‎<attached: 00000043-PHOTO-2025-03-14-20-10-34.jpg>
Sender: תראה מה מצאתי ‎image omitted        ← the same message, exported without media
```

So `classifyBody` matches markers as a tail and returns the preceding text as `caption`, which
`parse.ts` then uses as the body. Anchoring a marker pattern to the whole body
(`^<attached: …>$`) fails on every captioned photo: the message silently becomes plain text,
the attachment is lost, and identity falls back to the body hash — so the same photo lands
twice in a merged archive. Never re-anchor these patterns.

**iOS writes omitted markers in English even in a fully Hebrew chat** (`image omitted`,
`video omitted`, `sticker omitted`), and a *with-media* export still contains them for media no
longer on the device — 6 of 21 media messages in the real pair. `omitted-media` therefore does
not mean "exported without media", and the Verify screen must report omitted media honestly:
it is precisely what the user loses if they delete the chat.

**System detection looks only at the name-position text.** A pattern loose enough to span the
`Sender: ` prefix turns `Dana: I left my keys at home` and `Ravid: I changed my mind` into
senderless system messages — and those verbs are among the most common words in a chat. Every
real message has a `Sender: ` prefix, so no colon means system; when a colon *is* present,
`looksLikeSystemPhrase` is asked only about the text before it.

**Date order is a property of the file, not the line.** `03/04` is undecidable in isolation.
`inferDateOrder` scans all timestamps for a field above 12 before anything is resolved. Never
add a code path that resolves a date before that inference has run.

**Identity is minute-precision and media is positional.** iOS prints seconds and Android does
not, so identity truncates to the minute. A member who exported without media writes
`<Media omitted>` where another writes `<attached: IMG-0001.jpg>` — same message, different
body *and* kind — so media messages are identified by `(sender, minute, ordinal)` and never by
their body. Changing either rule breaks cross-member merge; both are covered by tests.

**Merge ties must break on content, not arrival order.** `pickCanonical` compares kind rank,
then a stable content key. Anything resembling "keep the first one" destroys commutativity,
and the property tests in `merge.test.ts` will catch it.

**Parsing degrades, it never throws.** Unrecognised lines become `ParseIssue`s and unknown
bodies stay `text` with content intact. Misclassifying is a display bug; dropping a line is
data loss.

## Writing fixtures

Fixtures written from the parser's assumptions confirm the model instead of testing it. The
first three parser bugs all survived a green suite for exactly that reason: every fixture put a
media caption on its own timestamped line (WhatsApp does not), used no ordinary message
containing a system verb, and contained no ZWJ sequence.

So: copy the *shape* of a real export, including the parts that look like noise. And prefer
checks that do not share assumptions with the code — `regression.test.ts` re-serializes parsed
messages and diffs them against the original source, which catches whole classes of error that
no hand-typed expectation would.

## The archive, and the two things that must not be re-broken

**The key wrapping lives in a cleartext header, not the manifest.** `header.json` is the only
unsealed file in an archive: format version, archive id, createdAt, KDF params, wrapped key.
Nothing about the chat.

It is separate because the obvious design does not work. Putting `keyWrapping` inside the
manifest — which is sealed *with the archive key* — means a user holding only their passphrase
can never open their own archive: they would need the key to read the thing storing the key.
And the passphrase path is the one that matters, because a key that exists only in the device
keychain dies with the device. Never move `keyWrapping` back into `Manifest`.

The header being unauthenticated has a consequence the reader already handles: `open()`
version-checks the header *and* re-checks the sealed manifest, so a downgraded header cannot
talk the app into reading a newer archive as v1. Keep both checks.

**`KdfParams.algorithm` is required, and a provider must reject one it cannot do.** This is the
single nastiest failure mode in the codebase if it regresses: an Argon2id-wrapped archive
opened by a PBKDF2-only provider derives a *different* key, the unwrap fails, and the user is
told "wrong passphrase" — forever, for a passphrase that was always correct. `createWebCryptoProvider`
throws `UnsupportedKdfError` instead. When the native Argon2id binding lands on mobile, branch
on `algorithm` **inside the provider**; do not remove the guard.

WebCrypto offers PBKDF2 only, which is why the default is PBKDF2-SHA256 despite Argon2id being
the better passphrase KDF.

## Ports, and why there are so many

Core touches no platform API. Everything it needs arrives as a structural interface it declares
itself and a caller satisfies: `SubtleCryptoLike` and `CryptoProvider` (crypto),
`MediaSource` (bytes out of an export), `ArchiveStoragePort` (object storage). None of them
import anything; all are satisfied structurally by the real thing.

Two consequences worth knowing before you add another:

- **Declare the narrowest interface that does the job.** `ArchiveStoragePort` deliberately has
  only `put`/`get`/`has` — no `list`, no `remove` — which makes "core cannot enumerate or delete
  a user's objects" a fact the compiler enforces rather than a rule someone has to remember.
- **Put platform knowledge in the contract, not in core.** `MediaSource.list()` is documented to
  return media candidates only, because core has no business hardcoding `_chat.txt` or
  `.DS_Store`. When a port's correctness depends on the caller doing something, say so in the
  interface's doc comment — that comment is the only place the implementer will look.

## Known limitations (documented, not bugs)

- **Cross-timezone merge.** Exports carry no timezone, so two members in different zones print
  different wall-clocks for the same message and will not dedupe. `ImportSource.tzOffsetMinutes`
  is the hook for fixing this; automatic offset detection is not implemented.
- **Sender aliases.** One member sees "Dana", another sees "+972 50-123-4567". No string
  normalization can reconcile these — `Manifest.participants[].aliases` is where the mapping
  belongs, and it must be populated by the UI, not guessed.
- **Locale coverage.** Marker classification covers English and Hebrew exactly and everything
  else by shape. Adding a locale means adding a fixture, not just a string.
- **Media filenames are matched byte-exactly**, with no Unicode normalization. APFS can hand
  back NFD where the transcript carries NFC, which would put one file in *both* `missing` and
  `unreferenced` — that co-occurrence is the detection signal. Every filename in the export we
  verified against is ASCII, so this is invisible today and was deliberately left alone rather
  than fixed speculatively.
- **`MediaRef` has no back-link to the messages referencing it**, so "which message is this
  photo for?" means scanning chunks. Combined with `Attachment.sha256` being optional, a chunk
  can name a filename with no content address at all. This is the seam to retrofit if media
  linkage needs to be queryable.
- **Append decrypts every chunk to decide reuse**, because `ChunkRef` carries no plaintext
  identity. Fine at current sizes; a `plaintextSha256` field would make it free at the cost of
  leaking slightly more structure to whoever can see the storage.
- **Argon2id is declarable but not implemented.** See the KDF note above.
