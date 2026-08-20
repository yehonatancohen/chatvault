/**
 * A2 — `MediaSource` over a WhatsApp export zip.
 *
 * `apps/mobile/CLAUDE.md`: `list()` must return media candidates only — `_chat.txt` and OS
 * debris are this app's job to filter, not core's. Mirrors `apps/web/lib/read-export.ts`,
 * which does the same filtering for the browser's `InMemoryMediaSource`.
 *
 * **Known limitation, not yet resolved**: `fflate.unzipSync` only operates on a zip already
 * fully in memory as one `Uint8Array`, and there is no pure-JS random-access zip reader that
 * can seek into a `File` on disk and inflate a single entry without first holding the whole
 * archive. That is exactly what `apps/mobile/CLAUDE.md` says not to do — "Stream media from
 * the export zip to storage; never read a whole zip into memory" — and it is the same
 * ~120 MB-class failure mode Step 0's `import.tsx` was built to avoid for the raw file. This
 * class does NOT yet satisfy that constraint: `ZipMediaSource.from` reads the entire file via
 * `file.bytes()` before anything else happens. It is fine for development against small
 * exports and unit tests, and wrong for a real with-media export at scale. Replacing it means
 * parsing the ZIP central directory from a `FileHandle` and inflating one entry at a time —
 * real work, deliberately not attempted here. `MAX_SAFE_ZIP_BYTES` exists so this fails loudly
 * on a large export rather than silently taking down the process.
 *
 * The list/read split each cost one central-directory scan, not one full decompression:
 * `unzipSync`'s `filter` callback runs for every entry before deciding whether to inflate it,
 * so `list()` (filter always returns `false`) never inflates anything, and `read()` inflates
 * only the one entry whose name matches.
 */

import { unzipSync } from "fflate";
import { MediaNotFoundError, type MediaSource } from "@chatvault/core";

/** Above this, refuse rather than risk the process being killed. See the class doc above. */
export const MAX_SAFE_ZIP_BYTES = 150 * 1024 * 1024;

export class ZipTooLargeError extends Error {
  constructor(readonly byteLength: number) {
    super(
      `This export is ${(byteLength / (1024 * 1024)).toFixed(0)} MB, too large for ` +
        "ZipMediaSource's in-memory reader. Needs the streaming replacement described in " +
        "zip-media-source.ts before an export this size can be imported safely.",
    );
    this.name = "ZipTooLargeError";
  }
}

export class ZipMediaSource implements MediaSource {
  private cachedNames: readonly string[] | null = null;

  constructor(private readonly zipBytes: Uint8Array) {
    if (zipBytes.length > MAX_SAFE_ZIP_BYTES) throw new ZipTooLargeError(zipBytes.length);
  }

  list(): Promise<readonly string[]> {
    if (this.cachedNames) return Promise.resolve(this.cachedNames);

    const names: string[] = [];
    unzipSync(this.zipBytes, {
      filter: (file) => {
        if (!isJunk(file.name)) names.push(file.name);
        return false;
      },
    });
    this.cachedNames = names;
    return Promise.resolve(names);
  }

  read(filename: string): Promise<Uint8Array> {
    const found = unzipSync(this.zipBytes, { filter: (file) => file.name === filename });
    const bytes = found[filename];
    if (!bytes) return Promise.reject(new MediaNotFoundError(filename));
    return Promise.resolve(Uint8Array.from(bytes));
  }
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
