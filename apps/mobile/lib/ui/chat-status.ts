/**
 * The one status each chat shows in the list — the answer to "can I delete this in WhatsApp?".
 *
 *   On this phone → Uploading → Safe to delete → Deleted · in Drive
 *
 * "Safe to delete" means the user's Google Drive holds the chat *as it is now*: a backup that
 * finished before the latest import does not count, because the newest messages would be
 * missing from it. "Deleted" is only ever what the user told us on the delete guide — the app
 * cannot see WhatsApp (root CLAUDE.md, invariants 1 and 7).
 *
 * Pure, so it is tested rather than eyeballed on a phone.
 */

export type ChatStatus =
  | { readonly kind: "device" }
  | { readonly kind: "uploading"; readonly fraction: number }
  | { readonly kind: "safe" }
  | { readonly kind: "deleted" };

export interface ChatStatusInput {
  /** When the archive last changed (`Manifest.updatedAt`). */
  readonly updatedAt: number;
  /** When the last *completed* backup to Drive finished, if ever. */
  readonly backedUpAt?: number | undefined;
  /** Progress of a backup running now (0–1), if one is — see `progressFraction`. */
  readonly uploading?: { readonly fraction: number } | undefined;
  /** When the user confirmed deleting the chat in WhatsApp, if they have. */
  readonly deletedAt?: number | undefined;
}

export function chatStatus(input: ChatStatusInput): ChatStatus {
  if (input.uploading !== undefined) {
    return { kind: "uploading", fraction: Math.max(0, Math.min(1, input.uploading.fraction)) };
  }
  const inDrive = input.backedUpAt !== undefined && input.backedUpAt >= input.updatedAt;
  if (!inDrive) return { kind: "device" };
  return input.deletedAt !== undefined ? { kind: "deleted" } : { kind: "safe" };
}

/**
 * How far along a backup is, 0–1. By bytes whenever the sync reports them — a chat is a few
 * large videos and many small files, and a bar that counts files races to 90% and then sits
 * there for the videos. Falls back to counting files when nothing is being uploaded.
 */
export function progressFraction(
  progress: { done: number; total: number; bytesDone?: number; bytesTotal?: number } | undefined,
): number {
  if (progress === undefined) return 0;
  if (progress.bytesTotal !== undefined && progress.bytesTotal > 0) {
    return Math.min(1, (progress.bytesDone ?? 0) / progress.bytesTotal);
  }
  return progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;
}
