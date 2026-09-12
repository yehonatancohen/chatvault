import type { CryptoProvider } from "../crypto/ports.js";
import { toHex } from "../crypto/sha256.js";
import type { MergedMessage } from "../merge.js";
import {
  aadFor,
  assertReadableVersion,
  decodeSealed,
  HEADER_PATH,
  KeyRequiredError,
  layoutFor,
  type ArchiveHeader,
  type ArchiveIndex,
  type ArchiveLayout,
  type ChunkRef,
  type KeyWrapping,
  type Manifest,
} from "./format.js";
import { decodeChunk } from "./jsonl.js";
import type { ArchiveStoragePort } from "./ports.js";
import { decodeUtf8 } from "../util/utf8.js";

/**
 * Reading a `.cvault`.
 *
 * The opening sequence is header -> key -> manifest -> chunks. `readHeader` is deliberately a
 * free function taking no key: a client with nothing but a passphrase starts there, derives
 * the wrapping key from the KDF parameters it finds, unwraps the archive key, and only then
 * constructs a reader.
 *
 * Lazy by construction: opening an archive costs one manifest, and a viewer scrolled to
 * March 2019 pays for the chunks it actually shows. Chunk boundaries are read from
 * `manifest.chunks`, never recomputed from `MESSAGES_PER_CHUNK` — the constant may have
 * changed since the archive was written, and an archive that becomes unreadable when we tune
 * a performance knob would defeat the entire point of the format being versioned.
 *
 * Two independent checks guard every chunk: the ciphertext hash from the manifest, and the
 * AEAD tag. The hash runs first and needs no key, so a corrupted download is diagnosed as
 * corruption rather than surfacing as an indistinguishable "wrong key" failure.
 */

export class ArchiveIntegrityError extends Error {
  constructor(
    readonly path: string,
    readonly expected: string,
    readonly found: string,
  ) {
    super(`Integrity check failed for ${path}: expected ${expected}, found ${found}`);
    this.name = "ArchiveIntegrityError";
  }
}

export class MalformedHeaderError extends Error {
  constructor(readonly detail: string) {
    super(`${HEADER_PATH} is not a readable archive header: ${detail}`);
    this.name = "MalformedHeaderError";
  }
}

/**
 * Reads the cleartext header. **Takes no key** — that is the entire point.
 *
 * This is the first call a client makes: it yields the KDF parameters and the wrapped key, so
 * a passphrase can be turned into the archive key (`CryptoProvider.deriveKey`, then `open` on
 * the wrapping) before `ArchiveReader.open` is ever reached. It also settles the format
 * version, so an archive from a newer app is refused here rather than after a pointless
 * decryption attempt.
 *
 * The header is unauthenticated by construction, so nothing it says is trusted for anything
 * but this: a tampered `iterations` or salt simply derives the wrong key and the archive stays
 * shut. It cannot be used to make a bad archive look good.
 */
export async function readHeader(
  storage: ArchiveStoragePort,
  archiveId: string,
): Promise<ArchiveHeader> {
  const parsed: unknown = JSON.parse(decodeUtf8(await storage.get(HEADER_PATH)));
  const header = asHeader(parsed);
  if (header.archiveId !== archiveId) {
    throw new MalformedHeaderError(`archiveId is ${header.archiveId}, expected ${archiveId}`);
  }
  assertReadableVersion(header);
  return header;
}

function asHeader(value: unknown): ArchiveHeader {
  if (typeof value !== "object" || value === null) throw new MalformedHeaderError("not an object");
  const record = value as Record<string, unknown>;
  const { formatVersion, archiveId, createdAt, keyWrapping, encryption } = record;

  if (typeof formatVersion !== "number") throw new MalformedHeaderError("formatVersion");
  if (typeof archiveId !== "string") throw new MalformedHeaderError("archiveId");
  if (typeof createdAt !== "number") throw new MalformedHeaderError("createdAt");
  if (encryption === "none") return { formatVersion, archiveId, createdAt, encryption };
  if (encryption !== undefined && encryption !== "aes-256-gcm") {
    throw new MalformedHeaderError(`encryption ${String(encryption)}`);
  }
  return { formatVersion, archiveId, createdAt, keyWrapping: asKeyWrapping(keyWrapping) };
}

function asKeyWrapping(value: unknown): KeyWrapping {
  if (typeof value !== "object" || value === null) throw new MalformedHeaderError("keyWrapping");
  const record = value as Record<string, unknown>;
  const { algorithm, saltBase64, iterations, wrappedKeyBase64, ivBase64 } = record;

  // Both algorithms are accepted here, but `createWebCryptoProvider.deriveKey` only implements
  // PBKDF2 and ignores this field — an Argon2id header opened by that provider derives the
  // wrong key and looks to the user like a wrong passphrase. Whoever wires up the native
  // Argon2id binding on mobile must branch on it, in the provider, before that path can ship.
  if (algorithm !== "PBKDF2-SHA256" && algorithm !== "Argon2id") {
    throw new MalformedHeaderError(`keyWrapping.algorithm ${String(algorithm)}`);
  }
  if (typeof saltBase64 !== "string") throw new MalformedHeaderError("keyWrapping.saltBase64");
  if (typeof iterations !== "number") throw new MalformedHeaderError("keyWrapping.iterations");
  if (typeof wrappedKeyBase64 !== "string") throw new MalformedHeaderError("keyWrapping.wrappedKeyBase64");
  if (typeof ivBase64 !== "string") throw new MalformedHeaderError("keyWrapping.ivBase64");

  return { algorithm, saltBase64, iterations, wrappedKeyBase64, ivBase64 };
}

/**
 * How many chunks `readAll`/`readChunks` fetch at once by default.
 *
 * Six is Drive's own per-host connection ceiling in a browser, so asking for more buys nothing
 * and only raises peak memory.
 */
export const CHUNK_CONCURRENCY = 6;

export class UnknownChunkError extends Error {
  constructor(readonly index: number) {
    super(`Archive has no chunk ${index}`);
    this.name = "UnknownChunkError";
  }
}

export interface ArchiveReaderOptions {
  readonly crypto: CryptoProvider;
  readonly storage: ArchiveStoragePort;
  /** Needed for a protected (sealed) archive; ignored for a plain one. */
  readonly key?: Uint8Array | undefined;
  readonly archiveId: string;
}

export class ArchiveReader {
  private readonly crypto: CryptoProvider;
  private readonly storage: ArchiveStoragePort;
  private readonly key: Uint8Array | undefined;
  private readonly archiveId: string;
  private readonly layout: ArchiveLayout;
  private cachedIndex: ArchiveIndex | null = null;

  private constructor(
    options: ArchiveReaderOptions,
    readonly header: ArchiveHeader,
    readonly manifest: Manifest,
  ) {
    this.crypto = options.crypto;
    this.storage = options.storage;
    this.key = options.key;
    this.archiveId = options.archiveId;
    this.layout = layoutFor(header);
  }

  /** Whether this archive is protected by a passphrase. */
  get encrypted(): boolean {
    return this.layout.sealed;
  }

  /**
   * Rejects on a wrong key (the manifest's AEAD tag fails) and on an archive written by a
   * newer app. Both are terminal: a half-read chat is worse to show a user than an error.
   *
   * The version check happens first, against the cleartext header, so an unopenable-by-design
   * archive is diagnosed correctly even when the caller's key is wrong or absent.
   */
  static async open(options: ArchiveReaderOptions): Promise<ArchiveReader> {
    const header = await readHeader(options.storage, options.archiveId);
    const layout = layoutFor(header);
    if (layout.sealed && options.key === undefined) throw new KeyRequiredError(options.archiveId);

    const stored = await options.storage.get(layout.manifest);
    const plaintext =
      layout.sealed && options.key !== undefined
        ? await options.crypto.open(
            options.key,
            decodeSealed(stored, layout.manifest),
            aadFor(options.archiveId, layout.manifest),
          )
        : stored;
    const manifest = JSON.parse(decodeUtf8(plaintext)) as Manifest;
    // Checked twice on purpose: the header is unauthenticated, so a downgraded version there
    // must not talk us into reading a newer sealed manifest as if it were v1.
    assertReadableVersion(manifest);
    return new ArchiveReader(options, header, manifest);
  }

  /** Chunk `index` as messages, verified then decrypted. */
  async readChunk(index: number): Promise<MergedMessage[]> {
    const ref = this.manifest.chunks.find((candidate) => candidate.index === index);
    if (!ref) throw new UnknownChunkError(index);
    return decodeChunk(decodeUtf8(await this.openChunk(ref)));
  }

  /**
   * The archive's chunk indices, oldest first.
   *
   * Public because a viewer that wants to paint before the whole chat has arrived needs to
   * choose its own order — the newest chunk first, then backwards — and `readAll` cannot
   * express that.
   */
  get chunkIndices(): number[] {
    return this.manifest.chunks.map((ref) => ref.index).sort((a, b) => a - b);
  }

  /**
   * Several chunks at once, returned in the order asked for.
   *
   * Chunks are independent — each is its own ciphertext with its own tag — so nothing about
   * the format requires reading them one at a time, and over a network round-trip latency
   * dominates: a 20-chunk archive read serially is twenty round trips deep, and the same read
   * six at a time is four. Concurrency is bounded rather than unlimited because each in-flight
   * chunk holds its ciphertext *and* its plaintext in memory, and the mobile Share Extension's
   * ~120 MB ceiling is not far away.
   *
   * Results keep the requested order however the responses interleave, so a caller can rely on
   * `readChunks([3, 2, 1])` coming back newest-first.
   */
  async readChunks(indices: readonly number[], concurrency = CHUNK_CONCURRENCY): Promise<MergedMessage[][]> {
    if (concurrency < 1) throw new RangeError("concurrency must be at least 1");
    const results: MergedMessage[][] = new Array<MergedMessage[]>(indices.length);
    let next = 0;

    const worker = async (): Promise<void> => {
      while (next < indices.length) {
        const slot = next++;
        results[slot] = await this.readChunk(indices[slot]!);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, indices.length) }, worker));
    return results;
  }

  /** Every message, in the archive's canonical order. */
  async readAll(concurrency = CHUNK_CONCURRENCY): Promise<MergedMessage[]> {
    const chunks = await this.readChunks(this.chunkIndices, concurrency);
    return chunks.flat();
  }

  /** Message id -> chunk index. Read once and kept; it is small and every lookup wants it. */
  async readIndex(): Promise<ArchiveIndex> {
    if (this.cachedIndex) return this.cachedIndex;
    const plaintext = await this.openAt(this.layout.index);
    const parsed = JSON.parse(decodeUtf8(plaintext)) as ArchiveIndex;
    this.cachedIndex = parsed;
    return parsed;
  }

  /**
   * One message by id, fetching only the chunk that holds it. `undefined` rather than a throw:
   * asking for a message another member has not contributed yet is an ordinary outcome.
   */
  async findMessage(id: string): Promise<MergedMessage | undefined> {
    const index = await this.readIndex();
    const chunkIndex = index[id];
    if (chunkIndex === undefined) return undefined;
    return (await this.readChunk(chunkIndex)).find((message) => message.id === id);
  }

  /**
   * A media blob by its content address, verified against that address after decryption —
   * which is a stronger check than the chunk hash, since the address *is* the plaintext hash.
   */
  async readMedia(sha256: string): Promise<Uint8Array> {
    const ref = this.manifest.media.find((candidate) => candidate.sha256 === sha256);
    const path = ref?.path ?? this.layout.media(sha256);
    const plaintext = await this.openAt(path);
    const found = toHex(await this.crypto.sha256(plaintext));
    if (found !== sha256) throw new ArchiveIntegrityError(path, sha256, found);
    return plaintext;
  }

  /**
   * A photo's small preview, or `undefined` if the archive has none for it — a normal state
   * (see `THUMBNAILS` in `format.ts`). Callers fall back to `readMedia`.
   */
  async readThumbnail(sha256: string): Promise<Uint8Array | undefined> {
    const path = this.layout.thumb(sha256);
    if (!(await this.storage.has(path))) return undefined;
    return this.openAt(path);
  }

  /**
   * Media as an async iterable, for consumers that want to pipe rather than hold a buffer.
   *
   * It yields exactly one part today, and that is a property of the *format*, not of this
   * method: a blob is one AES-GCM ciphertext, and GCM's tag only authenticates the whole
   * thing, so nothing may be handed out before the last byte has arrived. Real streaming
   * needs media sealed as a sequence of independently tagged frames — a format v2 change,
   * not something a reader can retrofit. Keeping the iterable shape means the call sites
   * written against it survive that change.
   */
  async *streamMedia(sha256: string): AsyncIterable<Uint8Array> {
    yield await this.readMedia(sha256);
  }

  private async openChunk(ref: ChunkRef): Promise<Uint8Array> {
    const path = this.layout.chunk(ref.index);
    const stored = await this.storage.get(path);

    if (!this.layout.sealed || this.key === undefined) {
      // Plain: the ref hashes the stored bytes themselves, so the same check still holds.
      const found = toHex(await this.crypto.sha256(stored));
      if (found !== ref.sha256) throw new ArchiveIntegrityError(path, ref.sha256, found);
      return stored;
    }

    const sealed = decodeSealed(stored, path);
    const found = toHex(await this.crypto.sha256(sealed.ciphertext));
    if (found !== ref.sha256) throw new ArchiveIntegrityError(path, ref.sha256, found);
    return this.crypto.open(this.key, sealed, aadFor(this.archiveId, path));
  }

  private async openAt(path: string): Promise<Uint8Array> {
    const stored = await this.storage.get(path);
    if (!this.layout.sealed || this.key === undefined) return stored;
    return this.crypto.open(this.key, decodeSealed(stored, path), aadFor(this.archiveId, path));
  }
}

