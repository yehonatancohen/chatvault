import { IV_LENGTH, type SealedBytes } from "../crypto/ports.js";
import { encodeUtf8 } from "../util/utf8.js";
import type { ImportSource } from "../types.js";

/**
 * The `.cvault` archive format.
 *
 * Append-only and content-addressed, so that merging is a set union and media deduplication
 * is a consequence of the layout rather than a step in the code. Chunks are never rewritten;
 * a new import adds chunks and replaces the manifest.
 *
 * ```
 * header.json            CLEARTEXT: format version, archive id, KDF params, wrapped key
 * manifest.json.enc      counts, participants, chunk list, sources
 * chunks/<n>.jsonl.enc   messages in id order, append-only
 * media/<sha256>.enc     content-addressed blobs — identical media stored once, ever
 * index.json.enc         message id -> chunk number, for lazy web viewing
 * ```
 *
 * Every payload is encrypted; the directory structure is the only thing in the clear. Note
 * that this leaks the *shape* of an archive (roughly how many messages, how much media) to
 * anyone who can see the storage. That is an accepted trade: hiding it would mean padding
 * every archive to a fixed size.
 */

/**
 * Bumped on any change to the on-disk shape. Archives outlive app versions — a user may open
 * a two-year-old vault — so a bump requires a migration, never a silent reinterpretation.
 * See root CLAUDE.md invariant 4.
 */
export const FORMAT_VERSION = 1;

/** Messages per chunk. Sized so the web viewer can fetch and decrypt a screenful quickly. */
export const MESSAGES_PER_CHUNK = 2_000;

export interface ChunkRef {
  readonly index: number;
  /** Hash of the *ciphertext*, so integrity can be checked without the key. */
  readonly sha256: string;
  readonly messageCount: number;
  /** Epoch ms of the first and last message, for range queries without decrypting. */
  readonly firstTs: number;
  readonly lastTs: number;
}

export interface MediaRef {
  /** Hash of the plaintext blob — this is also its filename under `media/`. */
  readonly sha256: string;
  readonly byteLength: number;
  /** Every filename any member's export used for this blob. */
  readonly filenames: readonly string[];
}

export interface KeyWrapping {
  readonly algorithm: "PBKDF2-SHA256" | "Argon2id";
  readonly saltBase64: string;
  readonly iterations: number;
  /** The archive key, sealed under the passphrase-derived key. */
  readonly wrappedKeyBase64: string;
  readonly ivBase64: string;
}

/**
 * The one object stored in the clear, at `HEADER_PATH`.
 *
 * It exists because the key wrapping cannot live in the manifest: the manifest is sealed
 * *with the archive key*, so a user holding only their passphrase would need the key to reach
 * the thing that stores the key. A passphrase has to be able to open an archive from nothing —
 * a key that lives only in a device keychain dies with the device, and the archive with it.
 *
 * What being cleartext leaks: that an archive exists here, when it was created, and the KDF
 * cost. Accepted deliberately. The alternative to leaking those three facts is an archive
 * nobody can open, and none of them says anything about the chat — no title, no participants,
 * no message count. It carries the *wrapped* key only; the archive key itself must never be
 * written here in any form.
 *
 * A second, real benefit: the version guard now runs without a key, so an app can tell a user
 * "this archive is newer than me" instead of making them discover it by failing to decrypt.
 *
 * Note for future readers: this amends format version 1 rather than migrating from it.
 * Nothing had shipped when the header was introduced, so there is no v1-without-header in the
 * wild and no migration to hunt for.
 */
export interface ArchiveHeader {
  readonly formatVersion: number;
  readonly archiveId: string;
  readonly createdAt: number;
  readonly keyWrapping: KeyWrapping;
}

export interface Manifest {
  readonly formatVersion: number;
  readonly archiveId: string;
  readonly chatTitle: string;
  /**
   * Canonical participant list. `aliases` maps the differing display names each member's
   * export used — a saved contact name in one, a raw phone number in another — onto one
   * identity, which no amount of string normalization could reconcile on its own.
   */
  readonly participants: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly aliases: readonly string[];
  }[];
  readonly sources: readonly ImportSource[];
  readonly chunks: readonly ChunkRef[];
  readonly media: readonly MediaRef[];
  readonly messageCount: number;
  readonly firstTs: number;
  readonly lastTs: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Message id -> the chunk holding it. Sealed at `INDEX_PATH` so the web viewer can jump. */
export type ArchiveIndex = Readonly<Record<string, number>>;

export class CorruptEnvelopeError extends Error {
  constructor(readonly path: string) {
    super(`Object at ${path} is too short to be a sealed envelope`);
    this.name = "CorruptEnvelopeError";
  }
}

/**
 * On-disk envelope: the 96-bit IV, then the GCM ciphertext-with-tag. A storage adapter holds
 * one object per payload, so the IV has to travel with it; there is nowhere else to put it.
 *
 * The IV sits *outside* `ChunkRef.sha256` (which covers the ciphertext alone, as an
 * integrity check anyone can run without the key) but *inside* the AEAD tag, so flipping a
 * byte of it fails the open rather than silently decrypting to garbage.
 */
export function encodeSealed(sealed: SealedBytes): Uint8Array {
  const out = new Uint8Array(sealed.iv.length + sealed.ciphertext.length);
  out.set(sealed.iv);
  out.set(sealed.ciphertext, sealed.iv.length);
  return out;
}

export function decodeSealed(bytes: Uint8Array, path: string): SealedBytes {
  if (bytes.length <= IV_LENGTH) throw new CorruptEnvelopeError(path);
  return { iv: bytes.slice(0, IV_LENGTH), ciphertext: bytes.slice(IV_LENGTH) };
}

export const chunkPath = (index: number): string => `chunks/${index}.jsonl.enc`;
export const mediaPath = (sha256: string): string => `media/${sha256}.enc`;
export const MANIFEST_PATH = "manifest.json.enc";
export const INDEX_PATH = "index.json.enc";
/** Plain UTF-8 JSON, never sealed — the `.enc`-less name is the reminder. See `ArchiveHeader`. */
export const HEADER_PATH = "header.json";

/**
 * Additional authenticated data for a payload. Binds each ciphertext to its archive and its
 * path, so a chunk cannot be swapped for a different chunk — or a chunk from another archive
 * — without the open failing.
 */
export function aadFor(archiveId: string, path: string): Uint8Array {
  return encodeUtf8(`cvault/${FORMAT_VERSION}/${archiveId}/${path}`);
}

export class UnsupportedFormatError extends Error {
  constructor(readonly found: number) {
    super(
      `Archive format version ${found} is newer than this app understands (${FORMAT_VERSION}). Update the app to open it.`,
    );
    this.name = "UnsupportedFormatError";
  }
}

/**
 * Guard before reading an archive. A *newer* archive is refused outright rather than
 * partially read: showing a user an incomplete chat is worse than showing them an error.
 *
 * Takes anything carrying a version, because the check that matters runs against the
 * *cleartext header* — before a key is involved at all. Making a user decrypt in order to
 * discover that they cannot decrypt was the old order, and it was backwards.
 */
export function assertReadableVersion(versioned: { readonly formatVersion: number }): void {
  if (versioned.formatVersion > FORMAT_VERSION) {
    throw new UnsupportedFormatError(versioned.formatVersion);
  }
}
