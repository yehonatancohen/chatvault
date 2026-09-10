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
import { parseExport, InMemoryMediaSource, type MediaSource, type ParseResult } from "@chatvault/core";
import { getCryptoProvider } from "../crypto/expo-crypto-provider";
import { createArchiveKey, wrapArchiveKey } from "../crypto/key-wrapping";
import {
  listArchiveIds,
  loadArchiveKey,
  newArchiveId,
  readArchiveHeader,
  saveArchiveKey,
  storageFor,
} from "../archive/vault";
import { ZipMediaSource } from "../media/zip-media-source";
import { chatTitleFromFilename, chooseTarget, type ArchiveCandidate } from "./match";
import { runImport, readArchiveMessageIds, type ImportOutcome } from "./run-import";
import { unwrapArchiveKey } from "../crypto/key-wrapping";

/** Above this, a text export is not read into a JS string. Same guard Step 0's screen used. */
const MAX_INLINE_TEXT_BYTES = 25 * 1024 * 1024;

export class ExportTooLargeError extends Error {
  constructor(readonly byteLength: number) {
    super(
      `This text export is ${(byteLength / (1024 * 1024)).toFixed(0)} MB — too large to read ` +
        "in one piece. Importing it needs the streaming reader that ZipMediaSource still owes.",
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
  /** A brand-new archive: the user picks the passphrase that will always open it. */
  | "new-passphrase"
  /** An existing archive whose key is not on this device — a restore, or someone else's. */
  | "unlock"
  /** Everything needed is already here. */
  | "ready";

export interface PreparedImport {
  readonly parsed: ParseResult;
  readonly transcript: string;
  readonly media: MediaSource;
  readonly archiveId: string;
  readonly chatTitle: string;
  readonly creating: boolean;
  readonly requirement: ImportRequirement;
  /** Messages of this export the target archive already holds. 0 when creating. */
  readonly overlap: number;
  readonly byteLength: number;
}

export async function prepareImport(params: {
  readonly path: string;
  readonly fileName?: string;
  readonly mimeType?: string;
}): Promise<PreparedImport> {
  const file = new File(params.path);
  if (!file.exists) throw new ShareFileMissingError(params.path);

  const byteLength = file.size ?? 0;
  const name = (params.fileName ?? "").toLowerCase();
  const isZip = name.endsWith(".zip") || params.mimeType === "application/zip";

  let transcript: string;
  let media: MediaSource;

  if (isZip) {
    // The whole zip lands in memory here — the A2 gap, capped rather than solved. See
    // `zip-media-source.ts`; `ZipTooLargeError` is what a too-large export gets instead of the
    // process being killed.
    const zip = new ZipMediaSource(await file.bytes());
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
    const hasKey = (await loadArchiveKey(archiveId)) !== null;
    return {
      parsed,
      transcript,
      media,
      archiveId,
      chatTitle: chatTitleFromFilename(params.fileName),
      creating: false,
      requirement: hasKey ? "ready" : "unlock",
      overlap: target.overlap,
      byteLength,
    };
  }

  return {
    parsed,
    transcript,
    media,
    archiveId: newArchiveId(),
    chatTitle: chatTitleFromFilename(params.fileName),
    creating: true,
    requirement: "new-passphrase",
    overlap: 0,
    byteLength,
  };
}

/**
 * Every archive this device can actually match against.
 *
 * A locked archive (no key in the Keychain) is skipped rather than unlocked: matching would
 * mean prompting for a passphrase for every archive on the phone before we can even say
 * whether this export is related to any of them. The cost of skipping is a duplicate archive
 * in a rare case, which merge can still reconcile later; the cost of prompting is an
 * interrogation on every import.
 */
async function readCandidates(): Promise<ArchiveCandidate[]> {
  const candidates: ArchiveCandidate[] = [];

  for (const archiveId of listArchiveIds()) {
    const key = await loadArchiveKey(archiveId);
    if (key === null) continue;
    try {
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
): Promise<CompleteImportResult> {
  const crypto = getCryptoProvider();
  const storage = storageFor(prepared.archiveId);

  const { key, keyWrapping } = prepared.creating
    ? await createKeyMaterial(prepared.archiveId, passphrase, crypto)
    : await existingKeyMaterial(prepared.archiveId, passphrase, crypto);

  const outcome = await runImport({
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
  });

  return { outcome, archiveId: prepared.archiveId };
}

async function createKeyMaterial(
  archiveId: string,
  passphrase: string | undefined,
  crypto: ReturnType<typeof getCryptoProvider>,
) {
  if (passphrase === undefined) throw new Error("A new archive needs a passphrase.");
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
) {
  const header = await readArchiveHeader(archiveId);
  const stored = await loadArchiveKey(archiveId);
  if (stored !== null) return { key: stored, keyWrapping: header.keyWrapping };

  if (passphrase === undefined) throw new Error("This archive needs its passphrase.");
  const key = await unwrapArchiveKey(header.keyWrapping, passphrase, crypto);
  await saveArchiveKey(archiveId, key);
  // The existing wrapping is passed straight back through. `ArchiveWriter.append` ignores it
  // and keeps the header it already has — re-wrapping would change the passphrase the user
  // has out from under them.
  return { key, keyWrapping: header.keyWrapping };
}
