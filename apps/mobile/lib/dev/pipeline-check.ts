/**
 * The import pipeline, checked inside the runtime that actually runs it.
 *
 * `lib/import/run-import.test.ts` proves the pipeline under Node, against WebCrypto and an
 * in-memory store. Everything it proves is real, and none of it is about *this* platform: on a
 * phone the crypto is `@noble` under Hermes, the hashing and CSPRNG are native modules, and the
 * storage is a filesystem. Each of those is a place the Node suite cannot reach.
 *
 * So this runs the same pipeline with the real providers, into a real (temporary) directory,
 * and returns results in the same shape the storage contract uses — the dev screen renders
 * both suites identically.
 *
 * The first three cases are the important ones: they compare Hermes' AES-GCM, PBKDF2 and
 * SHA-256 against fixed vectors produced by WebCrypto (`lib/crypto/vectors.ts`). Matching them
 * on a device is what makes the Node cross-provider tests mean something here — it says the
 * bytes this phone writes are the bytes a browser can read.
 *
 * Nothing here touches the user's archives: every case works in its own cache directory and
 * removes it afterwards.
 */

import { Directory, Paths } from "expo-file-system";
import { encodeUtf8, InMemoryMediaSource, type ContractResultLike } from "./types";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { createArchiveKey, unwrapArchiveKey, wrapArchiveKey } from "../crypto/key-wrapping";
import { fromBase64, toBase64 } from "../crypto/base64";
import * as vectors from "../crypto/vectors";
import { ExpoFileSystemStorageAdapter } from "../storage/expo-file-system-adapter";
import { runImport } from "../import/run-import";

const ROOT_NAME = "pipeline-check";
const LRM = "‎";

/** The same shape of fixture the Node suite uses: real export quirks, not convenient ones. */
const WITH_MEDIA = [
  `[14/03/2025, 20:10:31] דנה: ${LRM}Messages and calls are end-to-end encrypted.`,
  `[14/03/2025, 20:10:34] דנה: תראה מה מצאתי ${LRM}<attached: 00000043-PHOTO.jpg>`,
  `[14/03/2025, 20:11:02] יונתן: וואו`,
  `[14/03/2025, 20:12:00] יונתן: ${LRM}image omitted`,
  `[14/03/2025, 20:13:00] דנה: נדבר מחר`,
].join("\n");

const WITHOUT_MEDIA = [
  `[14/03/2025, 20:10:31] דנה: ${LRM}Messages and calls are end-to-end encrypted.`,
  `[14/03/2025, 20:10:34] דנה: תראה מה מצאתי ${LRM}image omitted`,
  `[14/03/2025, 20:11:02] יונתן: וואו`,
  `[14/03/2025, 20:12:00] יונתן: ${LRM}image omitted`,
  `[14/03/2025, 20:13:00] דנה: נדבר מחר`,
].join("\n");

const PHOTO = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 250, 0, 128]);

class CheckFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckFailure";
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new CheckFailure(message);
}

function assertEqual(actual: unknown, expected: unknown, what: string): void {
  if (actual !== expected) {
    throw new CheckFailure(`${what}: got ${String(actual)}, expected ${String(expected)}`);
  }
}

interface Check {
  readonly name: string;
  /** A returned string is shown next to a passing result — for measurements, not commentary. */
  run(directory: Directory): Promise<string | void>;
}

const checks: readonly Check[] = [
  {
    name: "AES-256-GCM matches the bytes WebCrypto produces",
    async run() {
      // Deterministic given key, IV, AAD and plaintext — so this compares ciphertext exactly,
      // not merely "it round-trips". A phone that passes this writes archives a browser opens.
      const crypto = getCryptoProvider();
      const opened = await crypto.open(
        vectors.AES_KEY_BYTES,
        { iv: vectors.AES_IV_BYTES, ciphertext: hexToBytes(vectors.AES_GCM_CIPHERTEXT_HEX) },
        encodeUtf8(vectors.AES_AAD),
      );
      assertEqual(decodeUtf8(opened), vectors.PLAINTEXT, "decrypting the recorded ciphertext");

      // And the other direction: seal, then confirm this build can reopen its own output with
      // the AAD bound. (The IV is chosen internally, so the ciphertext cannot be compared.)
      const sealed = await crypto.seal(
        vectors.AES_KEY_BYTES,
        encodeUtf8(vectors.PLAINTEXT),
        encodeUtf8(vectors.AES_AAD),
      );
      assertEqual(sealed.iv.length, 12, "IV length");
      const reopened = await crypto.open(vectors.AES_KEY_BYTES, sealed, encodeUtf8(vectors.AES_AAD));
      assertEqual(decodeUtf8(reopened), vectors.PLAINTEXT, "reopening our own ciphertext");
    },
  },
  {
    name: "PBKDF2-SHA256 matches the key WebCrypto derives",
    async run() {
      // If this fails, a passphrase set on this phone will not open the archive anywhere else.
      const derived = await getCryptoProvider().deriveKey(vectors.PBKDF2_PASSPHRASE, {
        salt: encodeUtf8(vectors.PBKDF2_SALT),
        iterations: vectors.PBKDF2_ITERATIONS,
        algorithm: "PBKDF2-SHA256",
      });
      assertEqual(vectors.toHex(derived), vectors.PBKDF2_KEY_HEX, "derived key");
    },
  },
  {
    name: "SHA-256 (native) matches, and the CSPRNG is not stuck",
    async run() {
      const crypto = getCryptoProvider();
      const digest = await crypto.sha256(encodeUtf8(vectors.PLAINTEXT));
      assertEqual(vectors.toHex(digest), vectors.SHA256_HEX, "SHA-256 of the vector plaintext");

      const a = crypto.randomBytes(32);
      const b = crypto.randomBytes(32);
      assertEqual(a.length, 32, "randomBytes length");
      assert(vectors.toHex(a) !== vectors.toHex(b), "two random reads returned identical bytes");
      assert(!a.every((byte) => byte === 0), "randomBytes returned all zeroes");
    },
  },
  {
    name: "base64 round-trips through the Keychain encoding",
    async run() {
      const key = getCryptoProvider().randomBytes(32);
      assertEqual(vectors.toHex(fromBase64(toBase64(key))), vectors.toHex(key), "base64 round-trip");
    },
  },
  {
    name: "a passphrase wraps and unwraps an archive key",
    async run() {
      const crypto = getCryptoProvider();
      const key = createArchiveKey(crypto);
      // Low iteration count on purpose: this case checks the wiring, and the real cost is
      // measured by the timing case below.
      const wrapping = await wrapArchiveKey(key, "a good passphrase", crypto, 1000);
      const unwrapped = await unwrapArchiveKey(wrapping, "a good passphrase", crypto);
      assertEqual(vectors.toHex(unwrapped), vectors.toHex(key), "unwrapped key");

      let rejected = false;
      try {
        await unwrapArchiveKey(wrapping, "the wrong passphrase", crypto);
      } catch {
        rejected = true;
      }
      assert(rejected, "the wrong passphrase unwrapped the key");
    },
  },
  {
    name: "import writes an archive to the filesystem and reads it back",
    async run(directory) {
      const outcome = await importInto(directory, WITH_MEDIA, new InMemoryMediaSource([
        ["00000043-PHOTO.jpg", PHOTO],
      ]));

      assertEqual(outcome.mode, "created", "mode");
      assertEqual(outcome.messageCount, 5, "message count");
      assertEqual(outcome.stats.attachedCount, 1, "attached media");
      assertEqual(outcome.stats.omittedCount, 1, "omitted media");
      assertEqual(outcome.stats.notArchivedCount, 1, "media not archived");
      assertEqual(outcome.stats.uniqueBlobCount, 1, "stored blobs");
    },
  },
  {
    name: "re-importing the same export absorbs it instead of doubling",
    async run(directory) {
      const media = () => new InMemoryMediaSource([["00000043-PHOTO.jpg", PHOTO]]);
      await importInto(directory, WITH_MEDIA, media());
      const second = await importInto(directory, WITH_MEDIA, media());

      assertEqual(second.mode, "appended", "mode");
      assertEqual(second.messageCount, 5, "message count after re-import");
      assertEqual(second.addedCount, 0, "added count");
    },
  },
  {
    name: "the without-media export merges into the with-media archive",
    async run(directory) {
      await importInto(directory, WITH_MEDIA, new InMemoryMediaSource([["00000043-PHOTO.jpg", PHOTO]]));
      const second = await importInto(directory, WITHOUT_MEDIA, new InMemoryMediaSource());

      assertEqual(second.messageCount, 5, "merged message count");
      assertEqual(second.addedCount, 0, "added count");
      // The photo must survive an append from a copy that does not have it.
      assertEqual(second.stats.uniqueBlobCount, 1, "stored blobs after merge");
      assertEqual(second.stats.missingCount, 0, "media wrongly reported missing");
    },
  },
  {
    name: "media comes back out byte-for-byte",
    async run(directory) {
      const outcome = await importInto(directory, WITH_MEDIA, new InMemoryMediaSource([
        ["00000043-PHOTO.jpg", PHOTO],
      ]));
      const ref = outcome.manifest.media[0];
      assert(ref !== undefined, "no media ref in the manifest");

      const { ArchiveReader } = await import("@chatvault/core");
      const reader = await ArchiveReader.open({
        crypto: getCryptoProvider(),
        storage: new ExpoFileSystemStorageAdapter(directory),
        key: TEST_KEY,
        archiveId: "check",
      });
      const bytes = await reader.readMedia(ref.sha256);
      assertEqual(vectors.toHex(bytes), vectors.toHex(PHOTO), "decrypted media bytes");
    },
  },
  {
    name: "measure: AES-256-GCM throughput",
    async run() {
      // The number that decides whether crypto can stay in JavaScript. Media is the bulk of an
      // archive and every byte of it is sealed, so this rate is the import's speed limit.
      // Hermes has no JIT; the same code measures ~59 MB/s under Node.
      const megabytes = 4;
      const blob = getCryptoProvider().randomBytes(1024);
      const blown = new Uint8Array(megabytes * 1024 * 1024);
      for (let offset = 0; offset < blown.length; offset += 1024) blown.set(blob, offset);

      const started = Date.now();
      await getCryptoProvider().seal(vectors.AES_KEY_BYTES, blown);
      const elapsed = Math.max(1, Date.now() - started);
      const rate = (megabytes * 1000) / elapsed;

      const note =
        `${rate.toFixed(2)} MB/s — a 50 MB export seals in about ` +
        `${Math.round(50 / rate)} s, a 300 MB one in about ${Math.round(300 / rate / 60)} min.`;
      // Only a catastrophic rate is a failure; the point of this case is the number itself.
      assert(rate > 0.2, `${note} That is unusable. Media sealing needs a native AES.`);
      return note;
    },
  },
  {
    name: "measure: PBKDF2 at the shipped cost",
    async run() {
      // Runs once when an archive is created and once per unlock, so it is a UX cost rather
      // than a per-byte one — but the rate here is the clearest read on how much slower this
      // device's JS is than a laptop's, and `key-wrapping.ts` says to measure it here.
      const { PBKDF2_ITERATIONS } = await import("../crypto/key-wrapping");
      const started = Date.now();
      await getCryptoProvider().deriveKey("measuring the real cost", {
        salt: getCryptoProvider().randomBytes(16),
        iterations: PBKDF2_ITERATIONS,
        algorithm: "PBKDF2-SHA256",
      });
      const elapsed = Date.now() - started;
      const note =
        `${(elapsed / 1000).toFixed(1)} s for ${PBKDF2_ITERATIONS} iterations ` +
        `(${Math.round(PBKDF2_ITERATIONS / (elapsed / 1000)).toLocaleString()}/s).`;

      // The threshold is "unusable", not "good". Anything above a second or two is already a
      // reason to move to a native KDF rather than to lower the cost — lowering it permanently
      // weakens every archive created meanwhile, since the count is recorded per archive.
      assert(
        elapsed < 60_000,
        `${note} An unlock cannot take this long; this needs a native KDF.`,
      );
      return note;
    },
  },
];

const TEST_KEY = Uint8Array.from({ length: 32 }, (_, i) => (i * 7) % 256);

const TEST_WRAPPING = {
  algorithm: "PBKDF2-SHA256" as const,
  saltBase64: "AAAAAAAAAAAAAAAAAAAAAA==",
  iterations: 1000,
  wrappedKeyBase64: "AAAA",
  ivBase64: "AAAAAAAAAAAAAAAA",
};

async function importInto(
  directory: Directory,
  transcript: string,
  media: InMemoryMediaSource,
): ReturnType<typeof runImport> {
  return runImport({
    transcript,
    media,
    storage: new ExpoFileSystemStorageAdapter(directory),
    crypto: getCryptoProvider(),
    key: TEST_KEY,
    archiveId: "check",
    keyWrapping: TEST_WRAPPING,
    chatTitle: "Check",
    sourceId: `check:${Date.now()}:${Math.random()}`,
    contributor: null,
    tzOffsetMinutes: 0,
  });
}

export async function runPipelineChecks(): Promise<readonly ContractResultLike[]> {
  const root = new Directory(Paths.cache, ROOT_NAME);
  if (root.exists) root.delete();

  const results: ContractResultLike[] = [];

  for (const [index, check] of checks.entries()) {
    const started = Date.now();
    const directory = new Directory(root, `case-${index}`);
    try {
      const note = await check.run(directory);
      results.push({
        name: check.name,
        status: "passed",
        ...(typeof note === "string" ? { detail: note } : {}),
        durationMs: Date.now() - started,
      });
    } catch (error) {
      results.push({
        name: check.name,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      });
    }
  }

  try {
    if (root.exists) root.delete();
  } catch {
    // The cache directory is the system's to reap; a cleanup failure is not a check failure.
  }

  return results;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function decodeUtf8(bytes: Uint8Array): string {
  // Local rather than imported from core's private util, and small enough not to matter.
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++]!;
    let cp: number;
    if (b0 < 0x80) cp = b0;
    else if ((b0 & 0xe0) === 0xc0) cp = ((b0 & 0x1f) << 6) | ((bytes[i++] ?? 0) & 0x3f);
    else if ((b0 & 0xf0) === 0xe0)
      cp = ((b0 & 0x0f) << 12) | (((bytes[i++] ?? 0) & 0x3f) << 6) | ((bytes[i++] ?? 0) & 0x3f);
    else
      cp =
        ((b0 & 0x07) << 18) |
        (((bytes[i++] ?? 0) & 0x3f) << 12) |
        (((bytes[i++] ?? 0) & 0x3f) << 6) |
        ((bytes[i++] ?? 0) & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out;
}
