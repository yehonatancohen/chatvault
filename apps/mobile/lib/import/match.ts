/**
 * Which archive does this export belong to?
 *
 * The one decision `core` cannot make. A user shares an export; the app must choose between
 * starting a new archive and appending to one it already has. Getting it wrong is expensive in
 * both directions: a wrong "new" leaves the user with two half-archives of one chat and a
 * merge that never happens, and a wrong "append" welds two unrelated chats together
 * permanently, because nothing in this product deletes.
 *
 * **The match is on message identity, not on the chat title.** Titles come from the export's
 * filename, which changes with the contact's display name, differs per member, and is absent
 * for a text-only share. Message ids are content-derived and stable across devices — that is
 * the entire premise merge already rests on (`packages/core/src/identity.ts`), so two exports
 * of one chat necessarily share ids, and two different chats essentially cannot.
 *
 * "Essentially cannot" is why there is a threshold rather than a single shared id. An id is
 * `(sender, minute, body)`; two chats containing the same person saying "ok" in the same minute
 * would collide on exactly one message. Requiring several makes an accidental match require a
 * coincidence nobody will ever hit, while a genuine re-export of the same chat overlaps by
 * hundreds.
 */

/** An archive already on the device, reduced to what matching needs. */
export interface ArchiveCandidate {
  readonly archiveId: string;
  /** Every message id the archive holds — `ArchiveIndex`'s keys. */
  readonly messageIds: ReadonlySet<string>;
}

export interface TargetChoice {
  readonly kind: "append" | "create";
  /** Set only when `kind` is `"append"`. */
  readonly archiveId?: string;
  readonly overlap: number;
  /** For the UI: how much of the incoming export the archive already had, 0–1. */
  readonly overlapRatio: number;
}

/**
 * Minimum shared messages before two exports are treated as the same chat.
 *
 * Four is a coincidence nobody will hit and a bar every real re-export clears by orders of
 * magnitude. A one- or two-message overlap between genuinely different chats is imaginable
 * ("ok", "👍", from the same person in the same minute); four is not.
 */
export const MIN_OVERLAP = 4;

/**
 * Small exports get a proportional rule instead: a 5-message export of a brand-new chat can
 * never reach `MIN_OVERLAP` against itself on re-import, and would archive twice forever.
 */
export const MIN_OVERLAP_RATIO = 0.5;

export function chooseTarget(
  candidates: readonly ArchiveCandidate[],
  incomingIds: ReadonlySet<string>,
): TargetChoice {
  let best: { archiveId: string; overlap: number } | undefined;

  for (const candidate of candidates) {
    let overlap = 0;
    for (const id of incomingIds) if (candidate.messageIds.has(id)) overlap++;
    // Strictly greater, so a tie keeps the earlier candidate: callers pass archives in a
    // stable order, and an unstable choice here would send successive imports of one chat to
    // different archives.
    if (overlap > 0 && (!best || overlap > best.overlap)) best = { archiveId: candidate.archiveId, overlap };
  }

  const incomingSize = incomingIds.size;
  if (!best || incomingSize === 0) {
    return { kind: "create", overlap: 0, overlapRatio: 0 };
  }

  const overlapRatio = best.overlap / incomingSize;
  const matched = best.overlap >= MIN_OVERLAP || overlapRatio >= MIN_OVERLAP_RATIO;

  return matched
    ? { kind: "append", archiveId: best.archiveId, overlap: best.overlap, overlapRatio }
    : { kind: "create", overlap: best.overlap, overlapRatio };
}

/**
 * A display title for the chat, from the filename WhatsApp produced.
 *
 * Exports are named `WhatsApp Chat - Dana.zip` (English) or `צ'אט וואטסאפ עם דנה.zip`
 * (Hebrew), among others. This strips the extension and any leading boilerplate up to the
 * first separator; when nothing recognisable is left it returns the bare filename rather than
 * inventing something. The title is cosmetic — nothing matches on it (see above) — so a
 * wrong guess costs a rename, not an archive.
 */
export function chatTitleFromFilename(filename: string | undefined): string {
  if (!filename) return "WhatsApp chat";

  const withoutExtension = filename.replace(/\.(zip|txt)$/i, "").trim();
  if (withoutExtension.length === 0) return "WhatsApp chat";

  // ` - ` (Latin) and ` עם ` (Hebrew "with") are the separators the real exports use. Split on
  // the first one only: a contact's own name may well contain a dash.
  const separator = withoutExtension.match(/ (?:-|עם|with|con|avec|mit) /);
  if (separator?.index !== undefined) {
    const tail = withoutExtension.slice(separator.index + separator[0].length).trim();
    if (tail.length > 0) return tail;
  }

  return withoutExtension;
}
