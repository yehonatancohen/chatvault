import { toHex } from "../crypto/sha256.js";
import type { CryptoProvider } from "../crypto/ports.js";
import { mergeBatches, mergeMerged, type MergedMessage, type MessageBatch } from "../merge.js";
import type { ImportSource } from "../types.js";
import {
  aadFor,
  decodeSealed,
  encodeSealed,
  HEADER_PATH,
  KeyRequiredError,
  layoutFor,
  MANIFEST_PATH,
  MESSAGES_PER_CHUNK,
  PLAIN_LAYOUT,
  PLAIN_MANIFEST_PATH,
  SEALED_LAYOUT,
  TRANSCRIPT_PATH,
  type ArchiveHeader,
  type ArchiveIndex,
  type ArchiveLayout,
  type ChunkRef,
  type KeyWrapping,
  type Manifest,
  type MediaRef,
} from "./format.js";
import { renderTranscript } from "./transcript.js";
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
    super(`Archive ${archiveId} has no ${HEADER_PATH}; it cannot be opened.`);
    this.name = "MissingHeaderError";
  }
}


/**
 * One media file, read on demand.
 *
 * `read()` rather than `bytes` because the alternative does not fit on a phone. A caller
 * holding an array of `{ filename, bytes }` is holding the whole export's media at once: a
 * 50 MB export measured at ~200 MB of live buffers that way, on a platform whose share
 * extension has a 120 MB ceiling and whose main app is not far behind. With a thunk, the
 * writer holds one blob at a time and drops it, so peak memory is the largest single file
 * rather than the sum of all of them.
 *
 * `sha256` is the plaintext content address when the caller already knows it — `linkMedia`
 * computes exactly this and throws it away otherwise. Supplying it lets the writer skip both
 * the re-hash *and* the read for media the archive already holds, which is the entire cost of
 * re-importing an export that has already been archived.
 *
 * **If `sha256` is supplied it must be correct.** It is the address the blob is stored at, so
 * a wrong value files the bytes under someone else's name. It is not verified here: the only
 * callers are this package's own `linkMedia` consumers, and re-hashing to check would give
 * back the cost the field exists to avoid. `ArchiveReader.readMedia` re-hashes on the way out,
 * so a mistake surfaces as an integrity error rather than as silent corruption.
 */
export interface MediaBlob {
  /** Name as the exporting member's WhatsApp wrote it — several may map to one blob. */
  readonly filename: string;
  /** Plaintext SHA-256, hex, when already known. See the note above before setting it. */
  readonly sha256?: string;
  read(): Promise<Uint8Array>;
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
  /**
   * The archive key itself, for a protected (sealed) archive. The writer never sees a
   * passphrase — see `keyWrapping`. **Omit both `key` and `keyWrapping` to write a plain,
   * unprotected archive**, which is the default since encryption became opt-in.
   *
   * `append` goes by the archive's own header, not by these options: a plain archive stays
   * plain and a sealed one stays sealed, whatever the caller passes — and a sealed one without
   * its key is refused (`KeyRequiredError`).
   */
  readonly key?: Uint8Array;
  readonly archiveId: string;
  /**
   * Copied verbatim into the cleartext header. Deriving and wrapping belongs to whoever holds
   * the passphrase, which is never this layer. `append` leaves the existing header untouched:
   * re-wrapping on every append would invalidate the passphrase the user already has.
   */
  readonly keyWrapping?: KeyWrapping;
  /** Overridable for tests that need to cross a chunk boundary without 2,000 messages. */
  readonly messagesPerChunk?: number;
  readonly now?: () => number;
}

export class ArchiveWriter {
  private readonly crypto: CryptoProvider;
  private readonly storage: ArchiveStoragePort;
  private readonly key: Uint8Array | undefined;
  private readonly archiveId: string;
  private readonly keyWrapping: KeyWrapping | undefined;
  /** Set by `write` from the options, and by `append` from the archive's header. */
  private layout: ArchiveLayout = PLAIN_LAYOUT;
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
    if ((await this.storage.has(MANIFEST_PATH)) || (await this.storage.has(PLAIN_MANIFEST_PATH))) {
      throw new ArchiveExistsError(this.archiveId);
    }
    if ((this.key === undefined) !== (this.keyWrapping === undefined)) {
      throw new Error("A protected archive needs both key and keyWrapping; a plain one needs neither.");
    }

    this.layout = this.key === undefined ? PLAIN_LAYOUT : SEALED_LAYOUT;
    const header: ArchiveHeader =
      this.keyWrapping === undefined
        ? {
            formatVersion: this.layout.formatVersion,
            archiveId: this.archiveId,
            createdAt: this.now(),
            encryption: "none",
          }
        : {
            formatVersion: this.layout.formatVersion,
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
    const header = JSON.parse(decodeUtf8(await this.storage.get(HEADER_PATH))) as ArchiveHeader;
    this.layout = layoutFor(header);
    if (this.layout.sealed && this.key === undefined) throw new KeyRequiredError(this.archiveId);

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
    await this.sealTo(this.layout.index, encodeUtf8(JSON.stringify(index satisfies ArchiveIndex)));

    if (!this.layout.sealed) {
      // The readable copy of the chat, for someone opening the folder without this app.
      const paths = new Map(media.map((ref) => [ref.sha256, ref.path ?? this.layout.media(ref.sha256)]));
      await this.storage.put(
        TRANSCRIPT_PATH,
        encodeUtf8(renderTranscript(content.chatTitle, messages, paths)),
      );
    }

    const createdAt = existing?.createdAt ?? this.now();
    const manifest: Manifest = {
      formatVersion: this.layout.formatVersion,
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

    await this.sealTo(this.layout.manifest, encodeUtf8(JSON.stringify(manifest)));
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

    const ciphertextHash = await this.sealTo(this.layout.chunk(indexNumber), encodeUtf8(text));
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
    const byHash = new Map<string, { byteLength: number; filenames: Set<string>; path?: string }>(
      existing.map((ref) => [
        ref.sha256,
        {
          byteLength: ref.byteLength,
          filenames: new Set(ref.filenames),
          ...(ref.path !== undefined ? { path: ref.path } : {}),
        },
      ]),
    );

    for (const blob of blobs) {
      // A blob whose address we already know, and which this archive already holds, needs
      // neither reading nor hashing — the ref is here, and only the filename alias might be
      // new. This is the whole of a re-import: nothing is inflated, nothing is sealed, and
      // peak memory never rises. Without it, re-importing a 50 MB export costs 50 MB of reads
      // to discover that every byte was already stored.
      if (blob.sha256 !== undefined) {
        const alreadyHeld = byHash.get(blob.sha256);
        if (alreadyHeld) {
          alreadyHeld.filenames.add(blob.filename);
          continue;
        }
      }

      // Read one blob, use it, drop it. The loop deliberately keeps no reference past its own
      // iteration — see `MediaBlob`.
      const bytes = await blob.read();
      const hash = blob.sha256 ?? toHex(await this.crypto.sha256(bytes));
      const known = byHash.get(hash);
      // A plain archive names the file after the first filename it arrived under, and keeps
      // that path for good — see `MediaRef.path`.
      const path = known?.path ?? this.layout.media(hash, blob.filename);
      if (known) {
        known.filenames.add(blob.filename);
      } else {
        byHash.set(hash, {
          byteLength: bytes.length,
          filenames: new Set([blob.filename]),
          ...(this.layout.sealed ? {} : { path }),
        });
      }

      // The path is the content address, so a second write would be a no-op — except that
      // re-sealing burns a fresh IV and rewrites bytes that other archives may already have
      // verified. Ask storage first: identical media is stored exactly once, ever.
      if (await this.storage.has(path)) continue;
      await this.sealTo(path, bytes);
    }

    return [...byHash.entries()]
      .map(([sha256, entry]) => ({
        sha256,
        byteLength: entry.byteLength,
        filenames: [...entry.filenames].sort(),
        ...(entry.path !== undefined ? { path: entry.path } : {}),
      }))
      .sort((a, b) => (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0));
  }

  /**
   * Writes `plaintext` to `path` — sealed in a protected archive, as-is in a plain one — and
   * returns the hex SHA-256 of the stored payload (the ciphertext, or the plain bytes).
   */
  private async sealTo(path: string, plaintext: Uint8Array): Promise<string> {
    if (!this.layout.sealed || this.key === undefined) {
      await this.storage.put(path, plaintext);
      return toHex(await this.crypto.sha256(plaintext));
    }
    const sealed = await this.crypto.seal(this.key, plaintext, aadFor(this.archiveId, path));
    await this.storage.put(path, encodeSealed(sealed));
    return toHex(await this.crypto.sha256(sealed.ciphertext));
  }

  private async openAt(path: string): Promise<Uint8Array> {
    const stored = await this.storage.get(path);
    if (!this.layout.sealed || this.key === undefined) return stored;
    return this.crypto.open(this.key, decodeSealed(stored, path), aadFor(this.archiveId, path));
  }

  private async readManifest(): Promise<Manifest> {
    const parsed: unknown = JSON.parse(decodeUtf8(await this.openAt(this.layout.manifest)));
    // No structural validation here on purpose: the manifest opened under our own AAD and key,
    // so it is a manifest this app wrote. The reader, which faces the user's archive rather
    // than one we just produced, is where the version guard lives.
    return parsed as Manifest;
  }

  private async readChunkText(indexNumber: number): Promise<string> {
    return decodeUtf8(await this.openAt(this.layout.chunk(indexNumber)));
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

