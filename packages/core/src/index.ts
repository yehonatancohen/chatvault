/**
 * @chatvault/core — the shared brain.
 *
 * Isomorphic TypeScript only: no `node:*`, no React Native modules, no DOM globals.
 * Platform capabilities enter through injected ports. See root CLAUDE.md, invariant 3.
 */

export type {
  Attachment,
  DateOrder,
  ExportDialect,
  ImportSource,
  MessageKind,
  ParseIssue,
  ParsedMessage,
  ParseResult,
} from "./types.js";

export { parseExport, type ParseOptions } from "./parser/parse.js";
export {
  canonicalizeForHash,
  normalizeExportText,
  normalizeInvisibles,
} from "./parser/text.js";
export { classifyBody, looksLikeSystemPhrase } from "./parser/markers.js";
export {
  inferClock,
  inferDateOrder,
  resolveDateTime,
  tokenizeDateTime,
  wallClockToEpoch,
  type DateTimeTokens,
  type ResolvedDateTime,
} from "./parser/datetime.js";

export { computeMessageId, IDENTITY_VERSION, type IdentityInput } from "./identity.js";
export {
  mergeBatches,
  mergeMerged,
  summarize,
  type MergedMessage,
  type MergeStats,
  type MessageBatch,
} from "./merge.js";

export {
  InMemoryMediaSource,
  MediaNotFoundError,
  type MediaSource,
} from "./media/source.js";
export { linkMedia, type MediaLinkResult, type MissingMedia } from "./media/link.js";
export { mediaStats, type MediaStats } from "./media/stats.js";

export { sha256Bytes, sha256Hex, toHex } from "./crypto/sha256.js";
export {
  createWebCryptoProvider,
  IV_LENGTH,
  KEY_LENGTH,
  UnsupportedKdfError,
  type CryptoProvider,
  type KdfAlgorithm,
  type KdfParams,
  type SealedBytes,
} from "./crypto/ports.js";

export {
  aadFor,
  assertReadableVersion,
  chunkPath,
  CorruptEnvelopeError,
  decodeSealed,
  encodeSealed,
  FORMAT_VERSION,
  HEADER_PATH,
  INDEX_PATH,
  isPlainHeader,
  KeyRequiredError,
  layoutFor,
  MANIFEST_PATH,
  mediaPath,
  MESSAGES_PER_CHUNK,
  PLAIN_FORMAT_VERSION,
  PLAIN_INDEX_PATH,
  PLAIN_LAYOUT,
  PLAIN_MANIFEST_PATH,
  SEALED_FORMAT_VERSION,
  SEALED_LAYOUT,
  THUMBNAILS,
  TRANSCRIPT_PATH,
  UnsupportedFormatError,
  type ArchiveHeader,
  type ArchiveLayout,
  type PlainArchiveHeader,
  type SealedArchiveHeader,
  type ArchiveIndex,
  type ChunkRef,
  type KeyWrapping,
  type Manifest,
  type MediaRef,
} from "./archive/format.js";

export {
  ArchiveExistsError,
  ArchiveWriter,
  MissingHeaderError,
  type ArchiveContent,
  type ArchiveParticipant,
  type ArchiveWriterOptions,
  type MediaBlob,
  type Thumbnailer,
} from "./archive/writer.js";
export {
  ArchiveIntegrityError,
  ArchiveReader,
  CHUNK_CONCURRENCY,
  MalformedHeaderError,
  readHeader,
  UnknownChunkError,
  type ArchiveReaderOptions,
} from "./archive/reader.js";
export type { ArchiveStoragePort } from "./archive/ports.js";
export { decodeChunk, encodeChunk, MalformedChunkError } from "./archive/jsonl.js";
export { renderTranscript } from "./archive/transcript.js";

/**
 * Exported for the clients, which decode export transcripts and archive JSON themselves.
 * `TextDecoder` is not in `lib ES2022` and is not guaranteed on Hermes — see `util/utf8.ts`.
 * A client reaching for the global directly is the hole invariant 3 exists to close.
 */
export { decodeUtf8, encodeUtf8 } from "./util/utf8.js";
