/**
 * The media capability, declared structurally.
 *
 * An iOS export is a `_chat.txt` with the media files sitting flat beside it — no subfolder,
 * no manifest of its own. Getting at those bytes means a zip reader on mobile and the File
 * API on the web, and core is allowed neither (root CLAUDE.md invariant 3), so it declares
 * the two calls it actually needs and lets each platform satisfy them structurally. The same
 * trick `crypto/ports.ts` plays with `SubtleCryptoLike`.
 *
 * Deliberately read-only: nothing in core may write to or delete from a user's export.
 */
export interface MediaSource {
  /**
   * The media candidates in this export.
   *
   * **The platform excludes non-media, not core.** A directory listing also contains
   * `_chat.txt` and whatever the OS dropped in (`.DS_Store`, `__MACOSX/`), and `linkMedia`
   * reports anything listed here that no message referenced. Leave the transcript in and the
   * Verify screen accuses every archive ever made of holding an unreferenced file. Core has
   * no business hardcoding those names, so the contract puts the filter on the caller.
   */
  list(): Promise<readonly string[]>;

  /** Rejects when the name is absent. Callers that expect absence check `list()` first. */
  read(filename: string): Promise<Uint8Array>;
}

export class MediaNotFoundError extends Error {
  constructor(readonly filename: string) {
    super(`No media named ${filename} in this source`);
    this.name = "MediaNotFoundError";
  }
}

/**
 * In-memory source for tests and for the web viewer, which already holds the decoded entries.
 *
 * `read` hands back a copy: a caller that hashes and then re-reads the same blob must not be
 * able to mutate what the next caller sees, and the real sources (a fresh zip inflate, a
 * fresh file read) do not share buffers either. Cheap fidelity to the platform behaviour.
 */
export class InMemoryMediaSource implements MediaSource {
  private readonly files: Map<string, Uint8Array>;

  constructor(files: Iterable<readonly [string, Uint8Array]> = []) {
    this.files = new Map(files);
  }

  static from(record: Readonly<Record<string, Uint8Array>>): InMemoryMediaSource {
    return new InMemoryMediaSource(Object.entries(record));
  }

  list(): Promise<readonly string[]> {
    return Promise.resolve([...this.files.keys()]);
  }

  read(filename: string): Promise<Uint8Array> {
    const bytes = this.files.get(filename);
    if (bytes === undefined) return Promise.reject(new MediaNotFoundError(filename));
    return Promise.resolve(Uint8Array.from(bytes));
  }
}
