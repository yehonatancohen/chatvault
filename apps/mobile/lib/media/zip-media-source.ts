/**
 * A2 — `MediaSource` over a WhatsApp export zip, read one entry at a time.
 *
 * `apps/mobile/CLAUDE.md`: `list()` must return media candidates only — `_chat.txt` and OS
 * debris are this app's job to filter, not core's. Mirrors `apps/web/lib/read-export.ts`,
 * which does the same filtering for the browser's `InMemoryMediaSource`.
 *
 * **No size limit.** This used to inflate from the whole zip held in memory, capped at 150 MB so
 * the process was not killed. Now the zip's central directory is read once and each entry is
 * read and inflated on its own from a `RandomAccess` (`zip-reader.ts`) — on the phone, a file
 * handle over the shared export (`file-random-access.ts`). Memory is about one entry at a time,
 * however large the export.
 */

import { decodeUtf8, MediaNotFoundError, type MediaSource } from "@chatvault/core";
import {
  bytesRandomAccess,
  readCentralDirectory,
  readEntry,
  type RandomAccess,
  type ZipEntry,
} from "./zip-reader";

export class ZipMediaSource implements MediaSource {
  private constructor(
    private readonly file: RandomAccess,
    private readonly entries: ReadonlyMap<string, ZipEntry>,
    private readonly names: readonly string[],
  ) {}

  /** Reads the central directory — the only part of the zip read up front. */
  static async open(file: RandomAccess): Promise<ZipMediaSource> {
    const entries = await readCentralDirectory(file);
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    return new ZipMediaSource(file, byName, entries.map((e) => e.name).filter((name) => !isJunk(name)));
  }

  /** For tests and small inputs already in memory. */
  static fromBytes(bytes: Uint8Array): Promise<ZipMediaSource> {
    return ZipMediaSource.open(bytesRandomAccess(bytes));
  }

  list(): Promise<readonly string[]> {
    return Promise.resolve(this.names);
  }

  /**
   * The chat transcript, which `list()` deliberately hides.
   *
   * `list()` returns media candidates only (the port's contract), so the one entry the parser
   * actually needs is invisible through the `MediaSource` interface — this is the way to it.
   * A real export names it `_chat.txt`, but that name is not guaranteed across locales and
   * platforms, so the rule is "the first non-junk `.txt` entry", matching `isJunk`'s own test
   * and `apps/web/lib/read-export.ts`.
   */
  async readTranscript(): Promise<string> {
    const entry = [...this.entries.values()].find((candidate) => isTranscript(candidate.name));
    if (entry === undefined) throw new NoTranscriptError();
    return decodeUtf8(await readEntry(this.file, entry));
  }

  async read(filename: string): Promise<Uint8Array> {
    const entry = this.entries.get(filename);
    if (entry === undefined || isJunk(filename)) throw new MediaNotFoundError(filename);
    return readEntry(this.file, entry);
  }
}

export class NoTranscriptError extends Error {
  constructor() {
    super(
      "This zip has no chat transcript in it. A WhatsApp export always contains one " +
        "(_chat.txt) — this may be an ordinary zip rather than an export.",
    );
    this.name = "NoTranscriptError";
  }
}

/** The transcript is the one `.txt` `isJunk` filters out of `list()`; this finds it again. */
function isTranscript(path: string): boolean {
  if (path.startsWith("__MACOSX/")) return false;
  const base = path.split("/").pop() ?? path;
  return base.toLowerCase().endsWith(".txt");
}

function isJunk(path: string): boolean {
  if (path.startsWith("__MACOSX/")) return true;
  if (path.endsWith("/")) return true; // directory entries
  const base = path.split("/").pop() ?? path;
  if (base === ".DS_Store") return true;
  if (base.toLowerCase() === "thumbs.db") return true;
  if (base.toLowerCase().endsWith(".txt")) return true; // _chat.txt itself
  return false;
}
