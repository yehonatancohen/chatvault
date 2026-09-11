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
  /** Progress of a backup running now, if one is. */
  readonly uploading?: { readonly done: number; readonly total: number } | undefined;
  /** When the user confirmed deleting the chat in WhatsApp, if they have. */
  readonly deletedAt?: number | undefined;
}

export function chatStatus(input: ChatStatusInput): ChatStatus {
  if (input.uploading !== undefined) {
    const { done, total } = input.uploading;
    return { kind: "uploading", fraction: total > 0 ? Math.min(1, done / total) : 0 };
  }
  const inDrive = input.backedUpAt !== undefined && input.backedUpAt >= input.updatedAt;
  if (!inDrive) return { kind: "device" };
  return input.deletedAt !== undefined ? { kind: "deleted" } : { kind: "safe" };
}
