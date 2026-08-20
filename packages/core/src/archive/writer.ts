import { toHex } from "../crypto/sha256.js";
import type { CryptoProvider } from "../crypto/ports.js";
import { mergeBatches, mergeMerged, type MergedMessage, type MessageBatch } from "../merge.js";
import type { ImportSource } from "../types.js";
import {
  aadFor,
  chunkPath,
  decodeSealed,
  encodeSealed,
  FORMAT_VERSION,
  HEADER_PATH,
  INDEX_PATH,
  MANIFEST_PATH,
  mediaPath,
  MESSAGES_PER_CHUNK,
  type ArchiveHeader,
  type ArchiveIndex,
  type ChunkRef,
  type KeyWrapping,
  type Manifest,
  type MediaRef,
} from "./format.js";
import { decodeChunk, encodeChunk } from "./jsonl.js";
import type { ArchiveStoragePort } from "./ports.js";
import { decodeUtf8, encodeUtf8 } from "../util/utf8.js";

/**
 * Writing a `.cvault`.
 *
 * The writer's whole job is to make merging cheap and repeatable: messages are ordered exactly
 * as `mergeBatches` returns them, sliced at fixed boundaries, and each slice sealed under an
 * AAD naming its own path. Because the order is deterministic, re-running a write over the
 * same inputs reproduces the same chunk *contents*, which is what lets `append` leave earlier
 * chunks untouched instead of rewriting the archive every time somebody contributes.
 *
 * Note the asymmetry in the two hashes, which is deliberate and easy to get backwards:
 * `ChunkRef.sha256` covers the ciphertext, so integrity is checkable by anyone without the
 * key; `MediaRef.sha256` covers the plaintext, because it *is* the blob's address and two
 * members' encryptions of the same photo must land on one path.
 */

export class ArchiveExistsError extends Error {
  constructor(readonly archiveId: string) {
    super(`Archive ${archiveId} already exists here — append to it instead of rewriting it.`);
    this.name = "ArchiveExistsError";
  }
}

export class MissingHeaderError extends Error {
  constructor(readonly archiveId: string) {
    super(`Archive ${archiveId} has no ${HEADER_PATH}; it cannot be opened by passphrase.`);
    this.name = "MissingHeaderError";
  }
}

export interface MediaBlob {
  /** Name as the exporting member's WhatsApp wrote it — several may map to one blob. */
  readonly filename: string;
  readonly bytes: Uint8Array;
}

export interface ArchiveParticipant {
  readonly id: string;
  readonly displayName: string;
  readonly aliases: readonly string[];
}

/** One write's worth of input: what a user just shared in, before merging. */
export interface ArchiveContent {
  readonly chatTitle: string;
  readonly participants: readonly ArchiveParticipant[];
  readonly sources: readonly ImportSource[];
  readonly batches: readonly MessageBatch[];
  readonly media?: readonly MediaBlob[];
}

export interface ArchiveWriterOptions {
  readonly crypto: CryptoProvider;
  readonly storage: ArchiveStoragePort;
  /** The archive key itself. The writer never sees a passphrase — see `keyWrapping`. */
  readonly key: Uint8Array;
  readonly archiveId: string;
  /**
   * Copied verbatim into the cleartext header. Deriving and wrapping belongs to whoever holds
   * the passphrase, which is never this layer. `append` leaves the existing header untouched:
   * re-wrapping on every append would invalidate the passphrase the user already has.
   */
  readonly keyWrapping: KeyWrapping;
  /** Overridable for tests that need to cross a chunk boundary without 2,000 messages. */
  readonly messagesPerChunk?: number;
  readonly now?: () => number;
}

export class ArchiveWriter {
  private readonly crypto: CryptoProvider;
  private readonly storage: ArchiveStoragePort;
  private readonly key: Uint8Array;
  private readonly archiveId: string;
  private readonly keyWrapping: KeyWrapping;
  private readonly messagesPerChunk: number;
  private readonly now: () => number;

  constructor(options: ArchiveWriterOptions) {
    this.crypto = options.crypto;
    this.storage = options.storage;
    this.key = options.key;
    this.archiveId = options.archiveId;
    this.keyWrapping = options.keyWrapping;
    this.messagesPerChunk = options.messagesPerChunk ?? MESSAGES_PER_CHUNK;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Write a fresh archive.
   *
   * Refuses if one already exists at this id, because a fresh write starts from an empty set
   * of media refs: the old blobs are still in storage (`has` sees them, so they are never
   * re-sealed) but nothing in the new manifest points at them, and neither this package nor
   * the storage layer is permitted to garbage-collect. That is a permanent orphan, so the
   * second write is an error rather than a leak. Use `append` to add to an existing archive.
   */
  async write(content: ArchiveContent): Promise<Manifest> {
    if (await this.storage.has(MANIFEST_PATH)) throw new ArchiveExistsError(this.archiveId);

    const header: ArchiveHeader = {
      formatVersion: FORMAT_VERSION,
      archiveId: this.archiveId,
      createdAt: this.now(),
      keyWrapping: this.keyWrapping,
    };
    // Cleartext, and the only object here that is. Nothing about the *chat* may be added to
    // it — see `ArchiveHeader` for what this is allowed to leak and why.
    await this.storage.put(HEADER_PATH, encodeUtf8(JSON.stringify(header)));

    return this.commit(content, mergeBatches(content.batches), null, new Map());
  }

  /**
   * Merge new content into an existing archive.
   *
   * Every existing chunk is decrypted, because merge needs the messages anyway — and having
   * the old plaintext in hand is exactly what makes the "has this chunk changed?" test exact.
   */
  async append(content: ArchiveContent): Promise<Manifest> {
    // The header is read, never rewritten, and this writer's own `keyWrapping` is ignored:
    // the passphrase that opens this archive was fixed when it was created, and silently
    // re-wrapping under a different one would lock the user out of their own vault.
    if (!(await this.storage.has(HEADER_PATH))) throw new MissingHeaderError(this.archiveId);

    const existing = await this.readManifest();
    const priorText = new Map<number, string>();
    const priorMessages: MergedMessage[][] = [];

    for (const ref of existing.chunks) {
      const text = await this.readChunkText(ref.index);
      priorText.set(ref.index, text);
      priorMessages.push(decodeChunk(text));
    }

    const merged = mergeMerged(...priorMessages, mergeBatches(content.batches));
    return this.commit(content, merged, existing, priorText);
  }

  private async commit(
    content: ArchiveContent,
    messages: readonly MergedMessage[],
    existing: Manifest | null,
    priorText: ReadonlyMap<number, string>,
  ): Promise<Manifest> {
    const priorRefs = new Map((existing?.chunks ?? []).map((ref) => [ref.index, ref]));
    const chunks: ChunkRef[] = [];
    const index: Record<string, number> = {};

    for (let i = 0; i * this.messagesPerChunk < messages.length; i++) {
      const slice = messages.slice(i * this.messagesPerChunk, (i + 1) * this.messagesPerChunk);
      for (const message of slice) index[message.id] = i;

      const text = encodeChunk(slice);
      const reusable = priorText.get(i) === text ? priorRefs.get(i) : undefined;
      // Reuse only on byte-identical plaintext. Comparing message *ids* would look right and
      // be wrong: a new source can upgrade an `omitted-media` message to a real attachment, or
      // just add itself to `sourceIds`, leaving the ids identical and the content stale.
      chunks.push(reusable ?? (await this.writeChunk(i, slice, text)));
    }

    const media = await this.writeMedia(content.media ?? [], existing?.media ?? []);
    await this.sealTo(INDEX_PATH, encodeUtf8(JSON.stringify(index satisfies ArchiveIndex)));

    const createdAt = existing?.createdAt ?? this.now();
    const manifest: Manifest = {
      formatVersion: FORMAT_VERSION,
      archiveId: this.archiveId,
      chatTitle: content.chatTitle,
      participants: mergeParticipants(existing?.participants ?? [], content.participants),
      sources: mergeSources(existing?.sources ?? [], content.sources),
      chunks,
      media,
      messageCount: messages.length,
      // An empty archive has no range to report. Zeroes rather than a sentinel: every consumer
      // already has to check `messageCount` before trusting a range.
      firstTs: messages[0]?.ts ?? 0,
      lastTs: messages[messages.length - 1]?.ts ?? 0,
      createdAt,
      updatedAt: this.now(),
    };

    await this.sealTo(MANIFEST_PATH, encodeUtf8(JSON.stringify(manifest)));
    return manifest;
  }

  private async writeChunk(
    indexNumber: number,
    slice: readonly MergedMessage[],
    text: string,
  ): Promise<ChunkRef> {
    const first = slice[0];
    const last = slice[slice.length - 1];
    if (!first || !last) throw new Error("refusing to write an empty chunk");

    const ciphertextHash = await this.sealTo(chunkPath(indexNumber), encodeUtf8(text));
    return {
      index: indexNumber,
      sha256: ciphertextHash,
      messageCount: slice.length,
      firstTs: first.ts,
      lastTs: last.ts,
    };
  }

  private async writeMedia(
    blobs: readonly MediaBlob[],
    existing: readonly MediaRef[],
  ): Promise<MediaRef[]> {
    const byHash = new Map<string, { byteLength: number; filenames: Set<string> }>(
      existing.map((ref) => [
        ref.sha256,
        { byteLength: ref.byteLength, filenames: new Set(ref.filenames) },
      ]),
    );

    for (const blob of blobs) {
      const hash = toHex(await this.crypto.sha256(blob.bytes));
      const known = byHash.get(hash);
      if (known) {
        known.filenames.add(blob.filename);
      } else {
        byHash.set(hash, { byteLength: blob.bytes.length, filenames: new Set([blob.filename]) });
      }

      // The path is the content address, so a second write would be a no-op — except that
      // re-sealing burns a fresh IV and rewrites bytes that other archives may already have
      // verified. Ask storage first: identical media is stored exactly once, ever.
      if (await this.storage.has(mediaPath(hash))) continue;
      await this.sealTo(mediaPath(hash), blob.bytes);
    }

    return [...byHash.entries()]
      .map(([sha256, entry]) => ({
        sha256,
        byteLength: entry.byteLength,
        filenames: [...entry.filenames].sort(),
      }))
      .sort((a, b) => (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0));
  }

  /** Seals `plaintext` to `path` and returns the hex SHA-256 of the ciphertext. */
  private async sealTo(path: string, plaintext: Uint8Array): Promise<string> {
    const sealed = await this.crypto.seal(this.key, plaintext, aadFor(this.archiveId, path));
    await this.storage.put(path, encodeSealed(sealed));
    return toHex(await this.crypto.sha256(sealed.ciphertext));
  }

  private async openAt(path: string): Promise<Uint8Array> {
    const stored = await this.storage.get(path);
    return this.crypto.open(this.key, decodeSealed(stored, path), aadFor(this.archiveId, path));
  }

  private async readManifest(): Promise<Manifest> {
    const parsed: unknown = JSON.parse(decodeUtf8(await this.openAt(MANIFEST_PATH)));
    // No structural validation here on purpose: the manifest opened under our own AAD and key,
    // so it is a manifest this app wrote. The reader, which faces the user's archive rather
    // than one we just produced, is where the version guard lives.
    return parsed as Manifest;
  }

  private async readChunkText(indexNumber: number): Promise<string> {
    return decodeUtf8(await this.openAt(chunkPath(indexNumber)));
  }
}

/** Later wins on display name; aliases accumulate, since dropping one un-merges a member. */
function mergeParticipants(
  existing: readonly ArchiveParticipant[],
  incoming: readonly ArchiveParticipant[],
): ArchiveParticipant[] {
  const byId = new Map<string, { displayName: string; aliases: Set<string> }>();

  for (const participant of [...existing, ...incoming]) {
    const found = byId.get(participant.id);
    if (found) {
      found.displayName = participant.displayName;
      for (const alias of participant.aliases) found.aliases.add(alias);
    } else {
      byId.set(participant.id, {
        displayName: participant.displayName,
        aliases: new Set(participant.aliases),
      });
    }
  }

  return [...byId.entries()].map(([id, entry]) => ({
    id,
    displayName: entry.displayName,
    aliases: [...entry.aliases].sort(),
  }));
}

/** Re-importing the same file must not lengthen the source list — merge is idempotent. */
function mergeSources(
  existing: readonly ImportSource[],
  incoming: readonly ImportSource[],
): ImportSource[] {
  const byId = new Map<string, ImportSource>();
  for (const source of [...existing, ...incoming]) byId.set(source.id, source);
  return [...byId.values()];
}

