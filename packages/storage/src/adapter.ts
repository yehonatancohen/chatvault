/**
 * The storage abstraction.
 *
 * v1 writes to the device only, but every write goes through this interface so that adding
 * Google Drive, iCloud, Dropbox or OneDrive later is a new file here rather than a change to
 * anything that calls it. Adapters see only ciphertext — they are handed sealed bytes and a
 * path, and have no way to interpret either.
 */

export interface StorageCapabilities {
  /** Whether `putStream`/`getStream` are implemented. Cloud adapters should aim for `true`. */
  readonly streaming: boolean;
  /** Hard per-object ceiling, if the backend has one. */
  readonly maxObjectBytes?: number;
  /** Whether the destination is reachable from the web client. iCloud, notably, is not. */
  readonly webReadable: boolean;
}

export class ObjectNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`No object at ${path}`);
    this.name = "ObjectNotFoundError";
  }
}

export interface StorageAdapter {
  /** Stable identifier persisted in the manifest, e.g. `"local"`, `"gdrive"`. */
  readonly id: string;

  put(path: string, data: Uint8Array): Promise<void>;
  /** Throws `ObjectNotFoundError` if absent — callers branch on `has` when absence is normal. */
  get(path: string): Promise<Uint8Array>;
  has(path: string): Promise<boolean>;
  /** Paths under `prefix`, in no guaranteed order. */
  list(prefix: string): Promise<string[]>;
  remove(path: string): Promise<void>;

  capabilities(): StorageCapabilities;

  /**
   * Optional streaming for large media. Present only when `capabilities().streaming` is true;
   * callers must fall back to `put`/`get` otherwise. Media blobs can be tens of megabytes and
   * buffering them whole is exactly what blows a mobile process's memory budget.
   */
  putStream?(path: string, data: AsyncIterable<Uint8Array>): Promise<void>;
  getStream?(path: string): AsyncIterable<Uint8Array>;
}
