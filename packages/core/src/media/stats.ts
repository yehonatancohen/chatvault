import type { MediaRef } from "../archive/format.js";
import type { ParsedMessage } from "../types.js";

/**
 * The numbers the mobile "Verify" screen shows before a user deletes anything.
 *
 * This is the most consequential screen in the app. Everything downstream of it is
 * irreversible and performed by the user's own hands in WhatsApp, so these counts have to be
 * honest about the gap between "messages that mention media" and "media we actually hold".
 * `notArchivedCount` is that gap, and it is the one number that must never be rounded away,
 * softened, or omitted from the UI: it is exactly what will be lost.
 *
 * Root CLAUDE.md invariant 1 is the other half of the same idea — we never delete anything
 * ourselves, we report and then guide.
 */
export interface MediaStats {
  /** Messages carrying media of any kind: `attachment` + `omitted-media`. */
  readonly totalMediaMessages: number;
  /** Messages whose export carried the file. Not all of these were found — see `missingCount`. */
  readonly attachedCount: number;
  /**
   * Messages the export itself omitted. WhatsApp writes these even in a "with media" export,
   * for media no longer on the device; the real iOS pair had 6 of them among 21.
   */
  readonly omittedCount: number;
  /** `attachment` messages whose filename never made it into a ref — absent or unreadable. */
  readonly missingCount: number;
  /**
   * Media this archive will NOT contain: `omittedCount + missingCount`. Show this to the user
   * verbatim. It is media that disappears when they delete the chat.
   */
  readonly notArchivedCount: number;
  /** Distinct blobs stored, after content-addressed dedup. */
  readonly uniqueBlobCount: number;
  /** Bytes the archive will hold: the sum over *unique* blobs, each counted once. */
  readonly totalBytes: number;
  /**
   * Bytes dedup avoided. Counted over filename occurrences, not message occurrences: two
   * members naming one photo differently save a copy, while two messages citing the same
   * filename were only ever one file and save nothing.
   */
  readonly dedupSavedBytes: number;
}

/**
 * Summarize linked media against the merged message list.
 *
 * **`refs` must be the archive's whole media list — `Manifest.media`, not one import's
 * `linkMedia` result.** `missingCount` is filename membership in `refs`, so passing only the
 * refs a single append produced marks every photo an *earlier* import already archived as
 * missing, and the screen tells the user they are about to lose media the archive is holding
 * for them. On a first import the two lists coincide, which is exactly why this goes wrong
 * later rather than in the test that would have caught it.
 *
 * Derived from the refs rather than from the link result's own counters on purpose: the
 * screen must report what the *manifest* says the archive holds, because that is what the
 * user's archive is actually built from.
 */
export function mediaStats(
  refs: readonly MediaRef[],
  messages: readonly ParsedMessage[],
): MediaStats {
  const stored = new Set<string>();
  let totalBytes = 0;
  let occurrenceBytes = 0;

  for (const ref of refs) {
    totalBytes += ref.byteLength;
    occurrenceBytes += ref.byteLength * ref.filenames.length;
    for (const filename of ref.filenames) stored.add(filename);
  }

  let attachedCount = 0;
  let omittedCount = 0;
  let missingCount = 0;

  for (const message of messages) {
    if (message.kind === "omitted-media") {
      omittedCount++;
      continue;
    }
    if (message.kind !== "attachment") continue;
    attachedCount++;
    // An attachment with no `attachment` field names nothing, so nothing can have been
    // stored for it — it counts as missing rather than being silently dropped from the total.
    if (message.attachment === undefined || !stored.has(message.attachment.filename)) {
      missingCount++;
    }
  }

  return {
    totalMediaMessages: attachedCount + omittedCount,
    attachedCount,
    omittedCount,
    missingCount,
    notArchivedCount: omittedCount + missingCount,
    uniqueBlobCount: refs.length,
    totalBytes,
    dedupSavedBytes: occurrenceBytes - totalBytes,
  };
}
