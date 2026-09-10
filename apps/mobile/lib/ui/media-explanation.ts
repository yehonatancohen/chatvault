/**
 * Explaining media the archive does not contain.
 *
 * "Not all media is saved" is the single most alarming sentence this app says, and it is said
 * at the moment a user is deciding whether to delete the only other copy. Getting it right is
 * not decoration: a user who does not understand *why* will either delete something they
 * wanted, or distrust the whole archive and delete nothing.
 *
 * The two causes look identical in the summary and are completely different in practice:
 *
 * - **WhatsApp omitted it.** The transcript literally says `image omitted`. The file is not on
 *   the phone any more — cleared to save space, never downloaded, or a view-once/disappearing
 *   message. Nothing was lost by us; it was already gone before the export ran. Crucially,
 *   this is *also* what a "without media" export looks like, which is a completely different
 *   situation with a completely different fix.
 * - **The export named a file it did not contain.** The chat references a filename that was
 *   not in the zip. Usually an interrupted or truncated export.
 *
 * The distinction drives the advice, so it is computed here — as data, tested — rather than
 * assembled inline in a screen where nobody can check it.
 *
 * The other thing this must say, and the previous copy did not: **the messages themselves are
 * archived either way.** Only the file is missing. A user reading "3 media files will not be
 * saved" reasonably fears they are losing three whole messages, and they are not.
 */

import type { MediaStats } from "@chatvault/core";

export type LossSeverity = "none" | "some" | "all";

export interface LossCause {
  readonly count: number;
  /** One line naming what happened, in the user's terms. */
  readonly what: string;
  /** Why it happened. The part that turns alarm into understanding. */
  readonly why: string;
}

export interface MediaExplanation {
  readonly severity: LossSeverity;
  readonly headline: string;
  /** What the archive *does* hold. Always present: the good news is information too. */
  readonly saved: string;
  readonly causes: readonly LossCause[];
  /** The reassurance that the messages survive even when their files do not. */
  readonly stillSaved?: string;
  /** Concrete, ordered, and only ever things that might actually work. */
  readonly nextSteps: readonly string[];
}

export function explainMedia(stats: MediaStats, exportHadMedia: boolean): MediaExplanation {
  const { omittedCount, missingCount, notArchivedCount, attachedCount, uniqueBlobCount } = stats;

  const saved =
    uniqueBlobCount === 0
      ? "No media files are in this archive."
      : `${count(uniqueBlobCount)} ${plural(uniqueBlobCount, "file")} saved and encrypted.`;

  if (notArchivedCount === 0) {
    return {
      severity: "none",
      headline:
        stats.totalMediaMessages === 0
          ? "This chat has no photos or files"
          : "Every photo and file in this chat was saved",
      saved,
      causes: [],
      nextSteps: [],
    };
  }

  // Nothing attached at all, and media messages exist: this is what a text-only export looks
  // like from here. Worth separating, because it is the one case with a complete fix.
  const nothingAttached = attachedCount === 0 && omittedCount > 0;
  const looksLikeTextOnlyExport = nothingAttached && !exportHadMedia;

  const causes: LossCause[] = [];

  if (omittedCount > 0) {
    causes.push({
      count: omittedCount,
      what: looksLikeTextOnlyExport
        ? `${count(omittedCount)} ${plural(omittedCount, "photo, video or file")} the export did not include`
        : `${count(omittedCount)} WhatsApp had already lost`,
      why: looksLikeTextOnlyExport
        ? "This export was made without media, so WhatsApp wrote a placeholder where each file " +
          "should be. The files are still in WhatsApp — they were simply not part of this export."
        : "WhatsApp wrote “image omitted” for these, meaning the file was no longer on this " +
          "phone when you exported. That usually means it was cleared to save space, was never " +
          "downloaded, or was a view-once or disappearing message. It was already gone before " +
          "ChatVault saw the chat.",
    });
  }

  if (missingCount > 0) {
    causes.push({
      count: missingCount,
      what: `${count(missingCount)} the export named but did not contain`,
      why:
        "The chat refers to these files by name, but they were not inside the file you shared. " +
        "That normally means the export was cut short — WhatsApp stops adding media once an " +
        "export gets large.",
    });
  }

  const nextSteps: string[] = [];
  if (looksLikeTextOnlyExport) {
    nextSteps.push(
      "Export the chat again and choose “Attach Media” this time, then share it here. " +
        "ChatVault will merge it into this archive — nothing is duplicated.",
    );
  } else {
    if (missingCount > 0) {
      nextSteps.push(
        "Export the chat again with media and share it here. A second export often completes " +
          "the files this one cut short, and merging adds only what is new.",
      );
    }
    if (omittedCount > 0) {
      nextSteps.push(
        "Open the chat in WhatsApp and scroll to the older photos so they download again, " +
          "then export once more. Anything WhatsApp can still fetch will be included.",
      );
    }
  }
  nextSteps.push(
    "Ask someone else in this chat to archive their copy. Their phone may still have files " +
      "yours no longer does, and their export merges into this same archive.",
  );

  return {
    severity: looksLikeTextOnlyExport || attachedCount === 0 ? "all" : "some",
    headline: looksLikeTextOnlyExport
      ? "This export did not include the media"
      : `${count(notArchivedCount)} ${plural(notArchivedCount, "file")} could not be saved`,
    saved,
    causes,
    stillSaved:
      "The messages themselves are safe. Who sent them, when, and any caption written with " +
      "the photo are all in the archive — it is only the file itself that is missing.",
    nextSteps,
  };
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}

function plural(value: number, singular: string): string {
  return value === 1 ? singular : `${singular}s`;
}
