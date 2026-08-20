import type { CryptoProvider } from "../crypto/ports.js";
import { toHex } from "../crypto/sha256.js";
import type { MergedMessage } from "../merge.js";
import {
  aadFor,
  assertReadableVersion,
  chunkPath,
  decodeSealed,
  HEADER_PATH,
  INDEX_PATH,
  MANIFEST_PATH,
  mediaPath,
  type ArchiveHeader,
  type ArchiveIndex,
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
  const { formatVersion, archiveId, createdAt, keyWrapping } = record;

  if (typeof formatVersion !== "number") throw new MalformedHeaderError("formatVersion");
  if (typeof archiveId !== "string") throw new MalformedHeaderError("archiveId");
  if (typeof createdAt !== "number") throw new MalformedHeaderError("createdAt");
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

export class UnknownChunkError extends Error {
  constructor(readonly index: number) {
    super(`Archive has no chunk ${index}`);
    this.name = "UnknownChunkError";
  }
}

export interface ArchiveReaderOptions {
  readonly crypto: CryptoProvider;
  readonly storage: ArchiveStoragePort;
  readonly key: Uint8Array;
  readonly archiveId: string;
}

export class ArchiveReader {
  private readonly crypto: CryptoProvider;
  private readonly storage: ArchiveStoragePort;
  private readonly key: Uint8Array;
  private readonly archiveId: string;
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

    const stored = await options.storage.get(MANIFEST_PATH);
    const plaintext = await options.crypto.open(
      options.key,
      decodeSealed(stored, MANIFEST_PATH),
      aadFor(options.archiveId, MANIFEST_PATH),
    );
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

  /** Every message, in the archive's canonical order. Chunks are read one at a time. */
  async readAll(): Promise<MergedMessage[]> {
    const messages: MergedMessage[] = [];
    for (const ref of [...this.manifest.chunks].sort((a, b) => a.index - b.index)) {
      messages.push(...decodeChunk(decodeUtf8(await this.openChunk(ref))));
    }
    return messages;
  }

  /** Message id -> chunk index. Read once and kept; it is small and every lookup wants it. */
  async readIndex(): Promise<ArchiveIndex> {
    if (this.cachedIndex) return this.cachedIndex;
    const plaintext = await this.openAt(INDEX_PATH);
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
    const path = mediaPath(sha256);
    const plaintext = await this.openAt(path);
    const found = toHex(await this.crypto.sha256(plaintext));
    if (found !== sha256) throw new ArchiveIntegrityError(path, sha256, found);
    return plaintext;
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
    const path = chunkPath(ref.index);
    const sealed = decodeSealed(await this.storage.get(path), path);

    const found = toHex(await this.crypto.sha256(sealed.ciphertext));
    if (found !== ref.sha256) throw new ArchiveIntegrityError(path, ref.sha256, found);

    return this.crypto.open(this.key, sealed, aadFor(this.archiveId, path));
  }

  private async openAt(path: string): Promise<Uint8Array> {
    const sealed = decodeSealed(await this.storage.get(path), path);
    return this.crypto.open(this.key, sealed, aadFor(this.archiveId, path));
  }
}

