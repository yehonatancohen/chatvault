import type { MediaRef } from "../archive/format.js";
import type { CryptoProvider } from "../crypto/ports.js";
import { toHex } from "../crypto/sha256.js";
import type { ParsedMessage } from "../types.js";
import type { MediaSource } from "./source.js";

/**
 * Linking parsed messages to the actual media bytes.
 *
 * A message names a file; the archive stores blobs by content. The join between them cannot
 * be the filename, because two members' devices give the *same photo* different names — one
 * exports `00000043-PHOTO-2025-03-14-20-10-34.jpg`, the other `IMG-0043.jpg` — and storing
 * both would double the archive and show the user the photo twice after a merge. So every
 * blob is addressed by the SHA-256 of its plaintext, and the filename becomes an alias
 * recorded on the ref.
 *
 * Two conditions this reports rather than throws on, because both are normal in a real
 * export and neither is the user's mistake:
 *
 * - **Missing**: a message names a file the source does not hold. A "with media" export still
 *   omits media WhatsApp no longer has on the device, and a truncated share or a corrupt zip
 *   entry looks the same from here. In the real iOS pair, 21 media messages produced 15
 *   attachments and 6 `omitted-media` — and that was the *good* export.
 * - **Unreferenced**: the source holds a file no message names. Usually the platform leaking
 *   `_chat.txt` or OS cruft into `list()` (see the port contract), occasionally a message
 *   whose header failed to parse.
 *
 * Surfacing them is the point: the Verify screen exists to tell a user exactly what the
 * archive will and will not contain *before* they delete the chat in WhatsApp.
 */

/** An attachment a message named that the source could not supply. */
export interface MissingMedia {
  readonly messageId: string;
  readonly filename: string;
  /** `"absent"` — not in `list()`; `"unreadable"` — listed but `read()` rejected. */
  readonly reason: "absent" | "unreadable";
}

export interface MediaLinkResult {
  /** Manifest-ready, content-addressed, deduplicated. Sorted by `sha256`. */
  readonly refs: readonly MediaRef[];
  /**
   * Message id -> plaintext SHA-256 hex, for messages whose blob was found. Absence here is
   * how a caller learns a message's media did not make it into the archive.
   */
  readonly byMessageId: ReadonlyMap<string, string>;
  /** Sorted by `(filename, messageId)`. */
  readonly missing: readonly MissingMedia[];
  /** Filenames present in the source but named by no message. Sorted. */
  readonly unreferenced: readonly string[];
}

interface HashedBlob {
  readonly sha256: string;
  readonly byteLength: number;
}

/**
 * Hash every referenced blob once and build the manifest's media section.
 *
 * Hashing goes through `CryptoProvider.sha256` and never the sync `sha256Hex`: these inputs
 * are whole photos and videos, and the pure-TS implementation is orders of magnitude slower
 * on multi-megabyte inputs (see `crypto/sha256.ts`). Hex-encoded via `toHex`, matching
 * `archive/writer.ts` exactly — the hash string *is* the storage path, so any encoding drift
 * would silently defeat dedup across appends.
 *
 * The bytes are read, hashed, and dropped. Keeping them would make the peak memory the size
 * of the whole export, and this runs where the iOS Share Extension's ~120 MB ceiling applies.
 * A caller feeding the writer re-reads `ref.filenames[0]`; that costs a second hash of each
 * blob in CPU, which is the cheap side of the trade.
 */
export async function linkMedia(
  messages: readonly ParsedMessage[],
  source: MediaSource,
  crypto: CryptoProvider,
): Promise<MediaLinkResult> {
  const available = new Set(await source.list());

  // Filename -> the messages naming it. Built first so each distinct file is read and hashed
  // exactly once no matter how many messages point at it (a forwarded photo, or the same
  // photo re-sent later in the chat).
  const referencedBy = new Map<string, string[]>();
  for (const message of messages) {
    // `attachment` is optional on `ParsedMessage`, so `kind: "attachment"` without one is
    // structurally reachable. It would be a parser bug; here it is simply not a reference.
    if (message.kind !== "attachment" || message.attachment === undefined) continue;
    const filename = message.attachment.filename;
    const ids = referencedBy.get(filename);
    if (ids) ids.push(message.id);
    else referencedBy.set(filename, [message.id]);
  }

  const blobs = new Map<string, HashedBlob>();
  const missing: MissingMedia[] = [];
  const byMessageId = new Map<string, string>();

  for (const [filename, messageIds] of referencedBy) {
    const blob = available.has(filename) ? await hash(source, filename, crypto) : null;

    if (blob === null) {
      // Listed-but-unreadable is a different story to tell the user than never-there, and a
      // corrupt zip entry produces the first while a partial share produces the second.
      const reason = available.has(filename) ? "unreadable" : "absent";
      for (const messageId of messageIds) missing.push({ messageId, filename, reason });
      continue;
    }

    blobs.set(filename, blob);
    for (const messageId of messageIds) byMessageId.set(messageId, blob.sha256);
  }

  const byHash = new Map<string, { byteLength: number; filenames: Set<string> }>();
  for (const [filename, blob] of blobs) {
    const known = byHash.get(blob.sha256);
    if (known) known.filenames.add(filename);
    else byHash.set(blob.sha256, { byteLength: blob.byteLength, filenames: new Set([filename]) });
  }

  const unreferenced = [...available].filter((name) => !referencedBy.has(name)).sort(compare);

  // Every list is sorted. The archive format is append-only and reproducible writes are what
  // let an append leave earlier chunks alone, so nothing user-visible may depend on the order
  // messages happened to arrive in.
  return {
    refs: [...byHash.entries()]
      .map(([sha256, entry]) => ({
        sha256,
        byteLength: entry.byteLength,
        filenames: [...entry.filenames].sort(compare),
      }))
      .sort((a, b) => compare(a.sha256, b.sha256)),
    byMessageId,
    missing: missing.sort(
      (a, b) =>
        compare(a.filename, b.filename) || compare(a.messageId, b.messageId),
    ),
    unreferenced,
  };
}

/**
 * Read and hash one file, or `null` if the source could not produce it.
 *
 * A rejected `read` is caught rather than propagated: `linkMedia` must degrade the way the
 * parser does. One unreadable photo out of two thousand messages is a line in a report, not
 * a reason to abandon an import the user is about to trust with their chat history.
 */
async function hash(
  source: MediaSource,
  filename: string,
  crypto: CryptoProvider,
): Promise<HashedBlob | null> {
  try {
    const bytes = await source.read(filename);
    return { sha256: toHex(await crypto.sha256(bytes)), byteLength: bytes.length };
  } catch {
    return null;
  }
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
