/**
 * Carries one import's result from the Import screen to the Verify screen.
 *
 * expo-router params are strings in a URL, and an `ImportOutcome` holds a whole manifest. The
 * alternatives were worse: serializing it through a param puts archive contents into a
 * navigation URL (which is the sort of place things get logged), and re-deriving it on the
 * Verify screen means decrypting the archive a second time to answer a question the import
 * already answered — including `addedCount`, which cannot be recovered after the fact at all.
 *
 * In memory only, and deliberately not a general-purpose store: it holds the last import, and
 * it is cleared as soon as the flow that needs it is done. Nothing here survives a reload, and
 * nothing here should: on a cold start there is no import in flight.
 */

import type { ImportOutcome } from "./run-import";

export interface ImportSession {
  readonly outcome: ImportOutcome;
  readonly archiveId: string;
  readonly chatTitle: string;
  /** Set only when this import created the archive — the Verify screen tells the user once. */
  readonly passphraseSet: boolean;
  /** Whether the export carried media, which changes what a media gap means. */
  readonly hadMedia: boolean;
}

let current: ImportSession | undefined;

export function setImportSession(session: ImportSession): void {
  current = session;
}

export function takeImportSession(): ImportSession | undefined {
  return current;
}

export function clearImportSession(): void {
  current = undefined;
}
