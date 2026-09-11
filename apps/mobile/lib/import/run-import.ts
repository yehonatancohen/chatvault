/**
 * A4 — the import pipeline. Export in, archive out.
 *
 * Everything here is wiring; `core` does the work. What this file owns is the *order* of the
 * steps and one decision core cannot make: whether this export starts a new archive or joins
 * an existing one (`chooseTarget` in `./match.ts`).
 *
 * Two properties are deliberate and worth keeping:
 *
 * **The numbers come from reading the archive back, not from what we believed we wrote.**
 * After the write, this reopens the archive through `ArchiveReader` — which re-checks the
 * format version and every chunk's ciphertext hash — and derives the Verify screen's counts
 * from *that*. It costs a full read. It buys the only thing that matters at that screen: when
 * we tell a user "127 messages are safely archived, you can delete the chat now", we are
 * reporting what came back out of the file, not what went in. A write that silently produced
 * an unreadable archive would otherwise look identical to a good one.
 *
 * **Everything is injected.** Storage, crypto and the media source arrive as ports, so this
 * whole pipeline runs under Node in `run-import.test.ts` against `MemoryStorageAdapter` and
 * WebCrypto. That is unusual for this app — nearly everything else in `apps/mobile` can only
 * be tested on a device — and it is the reason the import path is the one part of the mobile
 * app with real test coverage.
 */

import {
  ArchiveReader,
  ArchiveWriter,
  mediaStats,
  MANIFEST_PATH,
  PLAIN_MANIFEST_PATH,
  parseExport,
  type ArchiveStoragePort,
  type CryptoProvider,
  type ImportSource,
  type KeyWrapping,
  type Manifest,
  type MediaSource,
  type MediaStats,
  type MergedMessage,
  type ParseIssue,
  type ParseResult,
} from "@chatvault/core";
import { buildImport } from "./build-import";

export class EmptyExportError extends Error {
  constructor(readonly issueCount: number) {
    super(
      issueCount > 0
        ? `No messages could be read from this export — ${issueCount} lines were unparsable. ` +
          "Nothing has been written; the chat in WhatsApp is untouched."
        : "This export contains no messages. Nothing has been written; the chat in WhatsApp " +
          "is untouched.",
    );
    this.name = "EmptyExportError";
  }
}

/**
 * Where an import is, so a long one does not look like a hang and a failed one says where.
 *
 * Encrypting is JS-bound on Hermes and media is the bulk of an archive, so a large export can
 * legitimately take tens of seconds. Without this, that is indistinguishable from a freeze —
 * and when something does go wrong, "it failed" is a far worse bug report than "it failed
 * while writing".
 */
export type ImportStage =
  /**
   * Deriving or unwrapping the archive key. Reported by `completeImport` rather than by
   * `runImport`, because it happens before the pipeline starts — and it is not a formality:
   * PBKDF2 at the shipped cost was measured at 27.7 s on a real device. noble's `pbkdf2Async`
   * yields to the event loop as it goes, so the screen does update; without a stage of its
   * own, that whole time reads as a hung app.
   */
  | "deriving-key"
  | "parsing"
  | "checking-media"
  | "writing"
  | "verifying"
  /** Making the small photo previews the gallery shows. Reported by `completeImport`. */
  | "previews";

export interface ImportRequest {
  readonly transcript: string;
  /**
   * A parse of `transcript` the caller already has. The device flow parses once up front to
   * decide which archive this export belongs to (`chooseTarget` needs message ids), and
   * parsing a 40,000-message export twice for the same answer is pure waste. Omit it and this
   * parses `transcript` itself; pass one that does not match and every count will be wrong.
   */
  readonly parsed?: ParseResult;
  readonly media: MediaSource;
  readonly storage: ArchiveStoragePort;
  readonly crypto: CryptoProvider;
  /**
   * Only for a protected archive. Omit both `key` and `keyWrapping` to create a plain one — the
   * default. When appending, the archive's own header decides, not these.
   */
  readonly key?: Uint8Array | undefined;
  readonly archiveId: string;
  /** Ignored when appending: the passphrase that opens an archive is fixed at creation. */
  readonly keyWrapping?: KeyWrapping | undefined;
  readonly chatTitle: string;
  readonly sourceId: string;
  readonly contributor: string | null;
  /**
   * Minutes east of UTC the export's wall-clock times are assumed to be in. Exports carry no
   * timezone; getting this wrong is what stops two members' copies from merging.
   */
  readonly tzOffsetMinutes: number;
  readonly now?: () => number;
  readonly onProgress?: (stage: ImportStage) => void;
  /** Test hook only — crossing a chunk boundary without inventing 2,000 messages. */
  readonly messagesPerChunk?: number;
}

export interface ImportOutcome {
  readonly mode: "created" | "appended";
  readonly manifest: Manifest;
  readonly stats: MediaStats;
  /** Messages the archive holds *now*, read back out of it after writing. */
  readonly messageCount: number;
  /** How many of them this export contributed. Zero is a success, not a failure. */
  readonly addedCount: number;
  readonly firstTs: number;
  readonly lastTs: number;
  readonly participants: readonly string[];
  /** Lines the parser could not read. Shown honestly; parsing degrades, it never throws. */
  readonly issues: readonly ParseIssue[];
  /** Files this export named that it did not contain. Part of `stats.notArchivedCount`. */
  readonly missingCount: number;
  readonly unreferencedCount: number;
}

export async function runImport(request: ImportRequest): Promise<ImportOutcome> {
  const report = request.onProgress ?? (() => {});

  report("parsing");
  const parsed = request.parsed ?? parseExport(request.transcript);
  if (parsed.messages.length === 0) throw new EmptyExportError(parsed.issues.length);

  // `linkMedia` hashes every blob the export holds — the first place a large export spends
  // real time, and the first place it can fail on a corrupt zip entry.
  report("checking-media");
  const built = await buildImport(parsed, request.media, request.crypto, request.sourceId);

  const source: ImportSource = {
    id: request.sourceId,
    contributor: request.contributor,
    tzOffsetMinutes: request.tzOffsetMinutes,
    importedAt: (request.now ?? Date.now)(),
    dialect: parsed.dialect,
  };

  const writer = new ArchiveWriter({
    crypto: request.crypto,
    storage: request.storage,
    archiveId: request.archiveId,
    ...(request.key !== undefined && request.keyWrapping !== undefined
      ? { key: request.key, keyWrapping: request.keyWrapping }
      : request.key !== undefined
        ? { key: request.key }
        : {}),
    ...(request.now ? { now: request.now } : {}),
    ...(request.messagesPerChunk ? { messagesPerChunk: request.messagesPerChunk } : {}),
  });

  const content = {
    chatTitle: request.chatTitle,
    participants: built.participants,
    sources: [source],
    batches: [built.batch],
    media: built.media,
  };

  const appending =
    (await request.storage.has(MANIFEST_PATH)) || (await request.storage.has(PLAIN_MANIFEST_PATH));
  const before = appending ? await countExisting(request) : 0;

  // Sealing. On a phone this is pure-JS AES-GCM over every byte of media, and it is where a
  // big import spends most of its time.
  report("writing");
  await (appending ? writer.append(content) : writer.write(content));

  // Read it back. See the note at the top of this file: this is the step that turns "we wrote
  // an archive" into "an archive is here and it opens".
  report("verifying");
  const reader = await ArchiveReader.open({
    crypto: request.crypto,
    storage: request.storage,
    key: request.key,
    archiveId: request.archiveId,
  });
  const messages = await reader.readAll();
  const manifest = reader.manifest;

  return {
    mode: appending ? "appended" : "created",
    manifest,
    // The whole archive's refs against the whole archive's messages — `mediaStats` warns
    // explicitly that passing one import's refs makes every previously-archived photo look
    // missing, and that it only goes wrong on the second import, never the first.
    stats: mediaStats(manifest.media, messages),
    messageCount: messages.length,
    addedCount: messages.length - before,
    firstTs: manifest.firstTs,
    lastTs: manifest.lastTs,
    participants: manifest.participants.map((p) => p.displayName),
    issues: parsed.issues,
    missingCount: built.link.missing.length,
    unreferencedCount: built.link.unreferenced.length,
  };
}

/** Message count before this import, so the Verify screen can say what *this* export added. */
async function countExisting(request: ImportRequest): Promise<number> {
  const reader = await ArchiveReader.open({
    crypto: request.crypto,
    storage: request.storage,
    key: request.key,
    archiveId: request.archiveId,
  });
  return reader.manifest.messageCount;
}

/** Ids an archive already holds, for `chooseTarget`. Cheap: the index, not the chunks. */
export async function readArchiveMessageIds(options: {
  readonly crypto: CryptoProvider;
  readonly storage: ArchiveStoragePort;
  readonly key?: Uint8Array | undefined;
  readonly archiveId: string;
}): Promise<ReadonlySet<string>> {
  const reader = await ArchiveReader.open(options);
  return new Set(Object.keys(await reader.readIndex()));
}

export type { MergedMessage };
