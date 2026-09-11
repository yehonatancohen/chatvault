/**
 * The device half of A4: a shared file becomes an archive.
 *
 * Split into two phases because the question the user has to answer depends on an answer only
 * the file can give. Reading and parsing the export tells us whether it belongs to an archive
 * already on the phone; only then is it known whether to ask "choose a passphrase for this new
 * archive" or "unlock the existing one" or nothing at all. Asking before reading would mean
 * asking for a passphrase on every single import, including the ones that need none.
 *
 * Phase 1 `prepareImport` — read, parse, match. Writes nothing.
 * Phase 2 `completeImport` — key, then write, then read back.
 *
 * Nothing here is testable off-device (it touches the filesystem, the Keychain and the native
 * CSPRNG), which is why it holds no logic of its own: matching is `chooseTarget`, writing is
 * `runImport`, wrapping is `wrapArchiveKey`, and all three are tested under Node.
 */

import { File } from "expo-file-system";
import {
  ArchiveWriter,
  parseExport,
  InMemoryMediaSource,
  isPlainHeader,
  type KeyWrapping,
  type MediaSource,
  type ParseResult,
} from "@chatvault/core";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { createArchiveKey, wrapArchiveKey } from "../crypto/key-wrapping";
import {
  keyForArchive,
  listArchiveIds,
  newArchiveId,
  readArchiveHeader,
  saveArchiveKey,
  storageFor,
} from "../archive/vault";
import { ZipMediaSource } from "../media/zip-media-source";
import { openRandomAccess } from "../media/file-random-access";
import { makeThumbnail } from "../media/thumbnailer";
import { markPreviewsDone } from "../drive/backup-state";
import { chatTitleFromFilename, chooseTarget, type ArchiveCandidate } from "./match";
import {
  runImport,
  readArchiveMessageIds,
  type ImportOutcome,
  type ImportStage,
} from "./run-import";
import { unwrapArchiveKey } from "../crypto/key-wrapping";

/** Above this, a text export is not read into a JS string. Same guard Step 0's screen used. */
const MAX_INLINE_TEXT_BYTES = 25 * 1024 * 1024;

export class ExportTooLargeError extends Error {
  constructor(readonly byteLength: number) {
    super(
      `This text export is ${(byteLength / (1024 * 1024)).toFixed(0)} MB — too large to read ` +
        "in one piece. WhatsApp's own limit keeps a real transcript far below this.",
    );
    this.name = "ExportTooLargeError";
  }
}

export class ShareFileMissingError extends Error {
  constructor(readonly path: string) {
    super(
      `The share handed over ${path}, but nothing is there. That usually means the App Group ` +
        "container is not actually shared between the app and the extension.",
    );
    this.name = "ShareFileMissingError";
  }
}

/** What the UI must ask for before `completeImport` can run. */
export type ImportRequirement =
  /**
   * A brand-new chat. Nothing is required — it is saved plain unless the user chooses to protect
   * it with a passphrase, which is the one question the import screen asks.
   */
  | "new"
  /** An existing protected chat whose key is not on this device — a restore, or someone else's. */
  | "unlock"
  /** Everything needed is already here: an existing plain chat, or a protected one with its key. */
  | "ready";

export interface PreparedImport {
  readonly parsed: ParseResult;
  readonly transcript: string;
  readonly media: MediaSource;
  readonly archiveId: string;
  readonly chatTitle: string;
  readonly creating: boolean;
  /**
   * Whether the shared file was a with-media export. The Verify screen needs it to tell the
   * difference between "WhatsApp no longer had these files" and "you exported without media" —
   * identical in the counts, opposite in what the user should do about it.
   */
  readonly hadMedia: boolean;
  readonly requirement: ImportRequirement;
  /** Messages of this export the target archive already holds. 0 when creating. */
  readonly overlap: number;
  readonly byteLength: number;
  /** The shared export on disk — deleted once the chat is saved, so it does not linger. */
  readonly sourcePath: string;
  /** Closes the export's file handle. */
  readonly release: () => void;
}

export async function prepareImport(params: {
  readonly path: string;
  readonly fileName?: string;
  readonly mimeType?: string;
}): Promise<PreparedImport> {
  const file = new File(params.path);
  if (!file.exists) throw new ShareFileMissingError(params.path);
  sweepOldShares(file);

  const byteLength = file.size ?? 0;
  const name = (params.fileName ?? "").toLowerCase();
  const isZip = name.endsWith(".zip") || params.mimeType === "application/zip";

  let transcript: string;
  let media: MediaSource;
  let release = () => {};

  if (isZip) {
    // Read in place: the zip's table of contents now, each photo only when it is needed. No
    // size limit — memory is about one entry at a time (`zip-reader.ts`).
    const access = openRandomAccess(file);
    release = () => access.close();
    const zip = await ZipMediaSource.open(access);
    transcript = await zip.readTranscript();
    media = zip;
  } else {
    if (byteLength > MAX_INLINE_TEXT_BYTES) throw new ExportTooLargeError(byteLength);
    // `text()` rather than `textSync()`: the sync variant blocks the JS thread for the whole
    // read, and this can be tens of megabytes.
    transcript = await file.text();
    media = new InMemoryMediaSource();
  }

  const parsed = parseExport(transcript);
  const incomingIds = new Set(parsed.messages.map((message) => message.id));
  const candidates = await readCandidates();
  const target = chooseTarget(candidates, incomingIds);

  if (target.kind === "append" && target.archiveId !== undefined) {
    const archiveId = target.archiveId;
    const hasKey = (await keyForArchive(archiveId)) !== null;
    return {
      parsed,
      transcript,
      media,
      archiveId,
      chatTitle: chatTitleFromFilename(params.fileName),
      creating: false,
      hadMedia: isZip,
      requirement: hasKey ? "ready" : "unlock",
      overlap: target.overlap,
      byteLength,
      sourcePath: params.path,
      release,
    };
  }

  return {
    parsed,
    transcript,
    media,
    archiveId: newArchiveId(),
    chatTitle: chatTitleFromFilename(params.fileName),
    creating: true,
    hadMedia: isZip,
    requirement: "new",
    overlap: 0,
    byteLength,
    sourcePath: params.path,
    release,
  };
}

/**
 * Every archive this device can actually match against.
 *
 * Plain archives always qualify. A locked one (protected, no key in the Keychain) is skipped
 * rather than unlocked: matching would
 * mean prompting for a passphrase for every archive on the phone before we can even say
 * whether this export is related to any of them. The cost of skipping is a duplicate archive
 * in a rare case, which merge can still reconcile later; the cost of prompting is an
 * interrogation on every import.
 */
async function readCandidates(): Promise<ArchiveCandidate[]> {
  const candidates: ArchiveCandidate[] = [];

  for (const archiveId of listArchiveIds()) {
    try {
      const key = await keyForArchive(archiveId);
      if (key === null) continue;
      candidates.push({
        archiveId,
        messageIds: await readArchiveMessageIds({
          crypto: getCryptoProvider(),
          storage: storageFor(archiveId),
          key,
          archiveId,
        }),
      });
    } catch {
      // An archive that will not open cannot be matched against. The library screen reports
      // it as unreadable; an import is not the place to surface it.
    }
  }

  return candidates;
}

export interface CompleteImportResult {
  readonly outcome: ImportOutcome;
  readonly archiveId: string;
}

export async function completeImport(
  prepared: PreparedImport,
  passphrase: string | undefined,
  onProgress?: (stage: ImportStage) => void,
): Promise<CompleteImportResult> {
  const crypto = getCryptoProvider();
  const storage = storageFor(prepared.archiveId);

  onProgress?.("deriving-key");
  const { key, keyWrapping } = prepared.creating
    ? await createKeyMaterial(prepared.archiveId, passphrase, crypto)
    : await existingKeyMaterial(prepared.archiveId, passphrase, crypto);

  let outcome: ImportOutcome;
  try {
    outcome = await runImport({
      transcript: prepared.transcript,
      parsed: prepared.parsed,
      media: prepared.media,
      storage,
      crypto,
      key,
      archiveId: prepared.archiveId,
      keyWrapping,
      chatTitle: prepared.chatTitle,
      // A source is one import event. The id is per-import, not per-file: importing the same
      // file twice is a legitimate thing to do and merge is idempotent regardless.
      sourceId: `${prepared.archiveId}:${Date.now()}`,
      contributor: null,
      // Both exports come off this one phone, so a single consistent offset makes them merge.
      // Cross-timezone merge is a documented limitation (`packages/core/CLAUDE.md`) and needs a
      // per-source offset the UI does not yet collect.
      tzOffsetMinutes: -new Date().getTimezoneOffset(),
      ...(onProgress ? { onProgress } : {}),
    });
  } finally {
    // Close the export's file handle whether the import succeeded or not.
    prepared.release();
  }

  // Previews while the photos are still on the phone — before a backup moves them to Drive.
  // Never fails the import: a photo without a preview just shows the full image.
  onProgress?.("previews");
  try {
    await new ArchiveWriter({
      crypto,
      storage,
      archiveId: prepared.archiveId,
      ...(key !== undefined ? { key } : {}),
    }).addMissingThumbnails(makeThumbnail);
    await markPreviewsDone(prepared.archiveId);
  } catch {
    // The background pass (`backupPending`) tries again.
  }
  // The chat is saved; the shared export is now just a second copy taking up the phone. Deleting
  // it is part of the point of the app. (A failed import keeps it — `sweepOldShares` tidies up.)
  try {
    const source = new File(prepared.sourcePath);
    if (source.exists) source.delete();
  } catch {
    // Not worth failing a successful import over; the sweep will get it.
  }
  return { outcome, archiveId: prepared.archiveId };
}

/**
 * A new chat is plain unless the user gave a passphrase — then it is protected, and the key goes
 * into the Keychain before anything is written.
 */
async function createKeyMaterial(
  archiveId: string,
  passphrase: string | undefined,
  crypto: ReturnType<typeof getCryptoProvider>,
): Promise<{ key?: Uint8Array; keyWrapping?: KeyWrapping }> {
  if (passphrase === undefined || passphrase === "") return {};
  const key = createArchiveKey(crypto);
  const keyWrapping = await wrapArchiveKey(key, passphrase, crypto);
  // Saved before the write: an interrupted first import must not leave an archive on disk
  // whose key is nowhere. The header is written by the writer moments later, and
  // `listArchiveIds` skips a directory without one, so the failed case is invisible rather
  // than broken.
  await saveArchiveKey(archiveId, key);
  return { key, keyWrapping };
}

async function existingKeyMaterial(
  archiveId: string,
  passphrase: string | undefined,
  crypto: ReturnType<typeof getCryptoProvider>,
): Promise<{ key?: Uint8Array; keyWrapping?: KeyWrapping }> {
  const header = await readArchiveHeader(archiveId);
  // A plain chat stays plain: the writer follows its header, and there is nothing to unlock.
  if (isPlainHeader(header)) return {};
  const stored = await keyForArchive(archiveId);
  if (stored) return { key: stored, keyWrapping: header.keyWrapping };

  if (passphrase === undefined) throw new Error("This archive needs its passphrase.");
  const key = await unwrapArchiveKey(header.keyWrapping, passphrase, crypto);
  await saveArchiveKey(archiveId, key);
  // The existing wrapping is passed straight back through. `ArchiveWriter.append` ignores it
  // and keeps the header it already has — re-wrapping would change the passphrase the user
  // has out from under them.
  return { key, keyWrapping: header.keyWrapping };
}

/** Files the share extension names `<UUID>.<ext>` in the App Group container. */
const SHARED_COPY = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\.[A-Za-z0-9]+$/i;
const SHARE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Delete exports left behind by imports that never finished (a successful import deletes its
 * own). Only the extension's own `<UUID>.<ext>` copies, only a day old or more, never the one
 * being imported now — each can be hundreds of megabytes the user never sees.
 */
function sweepOldShares(current: File): void {
  try {
    const now = Date.now();
    for (const entry of current.parentDirectory.list()) {
      if (!(entry instanceof File) || entry.uri === current.uri || !SHARED_COPY.test(entry.name)) continue;
      const modified = entry.modificationTime ?? now;
      if (now - modified > SHARE_MAX_AGE_MS) entry.delete();
    }
  } catch {
    // Housekeeping; never a reason to fail an import.
  }
}
