/**
 * The archive's media, as a gallery rather than as storage.
 *
 * `Manifest.media` is a list of content-addressed blobs: hash, size, and the filenames members
 * gave them. It has no sender and no date, and it deliberately never will — a blob is shared
 * between every message that references it, and `packages/core/CLAUDE.md` lists the missing
 * back-link as known debt rather than an oversight.
 *
 * So a gallery has to be built from the other side: walk the messages, keep the ones carrying a
 * content address, and let each blob inherit the time and sender of the *first* message that
 * used it. First rather than last because that is when the photo entered the conversation; a
 * forward months later is not when it was taken or sent.
 */

import type { MediaRef, MergedMessage } from "@chatvault/core";
import { mediaKindOf, type MediaKind } from "./mime";

export interface MediaItem {
  readonly sha256: string;
  readonly filename: string;
  readonly kind: MediaKind;
  /** When it first appeared in the conversation. */
  readonly ts: number;
  readonly sender: string | null;
  readonly byteLength: number;
}

/**
 * Newest first, which is the order a gallery is read in — and the order that puts the photos
 * someone actually remembers at the top rather than the oldest thing in the archive.
 */
export function buildMediaIndex(
  messages: readonly MergedMessage[],
  refs: readonly MediaRef[],
): MediaItem[] {
  const sizes = new Map(refs.map((ref) => [ref.sha256, ref.byteLength]));
  const held = new Set(refs.map((ref) => ref.sha256));
  const byHash = new Map<string, MediaItem>();

  for (const message of messages) {
    const attachment = message.attachment;
    if (message.kind !== "attachment" || attachment?.sha256 === undefined) continue;
    // A message can name a file the archive does not hold — the gallery shows what is *here*,
    // and the Verify and info screens are where the gap is reported.
    if (!held.has(attachment.sha256)) continue;
    if (byHash.has(attachment.sha256)) continue;

    byHash.set(attachment.sha256, {
      sha256: attachment.sha256,
      filename: attachment.filename,
      kind: mediaKindOf(attachment.filename),
      ts: message.ts,
      sender: message.sender,
      byteLength: sizes.get(attachment.sha256) ?? 0,
    });
  }

  return [...byHash.values()].sort((a, b) => b.ts - a.ts);
}

/** Just the images, for a grid that can actually render its contents. */
export function imagesOnly(items: readonly MediaItem[]): MediaItem[] {
  return items.filter((item) => item.kind === "image");
}

/**
 * One image to stand for the whole chat in the library.
 *
 * The *smallest* image, not the newest, and that is a performance decision rather than an
 * editorial one: this is decrypted while a list is rendering, and the small ones are stickers
 * and thumbnails that cost almost nothing. A library of six chats should not decrypt six
 * full-size photos to draw six 48-pixel circles.
 */
export function pickChatThumbnail(items: readonly MediaItem[]): MediaItem | undefined {
  let best: MediaItem | undefined;
  for (const item of items) {
    if (item.kind !== "image") continue;
    if (!best || item.byteLength < best.byteLength) best = item;
  }
  return best;
}

/**
 * Initials for the fallback avatar: at most two, from the chat title.
 *
 * Grapheme-aware via the spread operator, because a title can begin with an emoji or a Hebrew
 * letter and `charAt(0)` would split a surrogate pair into a replacement character.
 */
export function initialsFor(title: string): string {
  const words = title.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return "?";
  const first = [...words[0]!][0] ?? "?";
  if (words.length === 1) return first.toUpperCase();
  const second = [...words[words.length - 1]!][0] ?? "";
  return (first + second).toUpperCase();
}
