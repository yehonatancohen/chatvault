import {
  ObjectNotFoundError,
  type StorageAdapter,
  type StorageCapabilities,
} from "./adapter.js";

/**
 * In-memory adapter.
 *
 * Not a mock — it is the reference implementation the conformance suite runs against, and the
 * backing store for tests of anything that writes an archive. Every real adapter must pass the
 * same suite (`conformance.ts`), which is what keeps a Drive adapter's behaviour honest
 * against the one we can fully observe.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly id = "memory";

  private readonly objects = new Map<string, Uint8Array>();

  put(path: string, data: Uint8Array): Promise<void> {
    // Copy on write: callers reuse buffers, and a stored object must not mutate underneath.
    this.objects.set(path, Uint8Array.from(data));
    return Promise.resolve();
  }

  get(path: string): Promise<Uint8Array> {
    const found = this.objects.get(path);
    if (!found) return Promise.reject(new ObjectNotFoundError(path));
    return Promise.resolve(Uint8Array.from(found));
  }

  has(path: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(path));
  }

  list(prefix: string): Promise<string[]> {
    return Promise.resolve([...this.objects.keys()].filter((p) => p.startsWith(prefix)));
  }

  remove(path: string): Promise<void> {
    this.objects.delete(path);
    return Promise.resolve();
  }

  capabilities(): StorageCapabilities {
    return { streaming: false, webReadable: true };
  }

  /** Test helper: total bytes held, for asserting media deduplication actually happened. */
  totalBytes(): number {
    let total = 0;
    for (const value of this.objects.values()) total += value.byteLength;
    return total;
  }
}
