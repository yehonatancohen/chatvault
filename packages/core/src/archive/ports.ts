/**
 * The storage capability, declared structurally.
 *
 * `@chatvault/storage` owns the real `StorageAdapter`, but core must not import it: core is
 * the thing every other package depends on, and depending back on a sibling would invert
 * that. So the archive declares the three methods it actually uses and any adapter satisfies
 * them structurally — the same trick `crypto/ports.ts` plays with `SubtleCryptoLike`.
 *
 * Deliberately narrower than `StorageAdapter`: no `list`, no `remove`. Nothing in core is
 * allowed to enumerate or delete a user's objects, and a port that cannot express those calls
 * makes that a compile-time fact rather than a review note.
 */
export interface ArchiveStoragePort {
  put(path: string, data: Uint8Array): Promise<void>;
  /** Rejects when the object is absent; callers branch on `has` when absence is expected. */
  get(path: string): Promise<Uint8Array>;
  has(path: string): Promise<boolean>;
}
