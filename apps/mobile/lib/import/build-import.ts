/**
 * `ParseResult` + a `MediaSource` -> what `ArchiveWriter` actually wants: a `MessageBatch`
 * whose attachment messages carry a content hash, and the `MediaBlob[]` to seal.
 * `parseExport` never fills in `Attachment.sha256` — its doc comment says when that happens,
 * "once the blob is read out of the export zip", and this is that step.
 *
 * Deliberately the same shape as `apps/web/lib/build-import.ts`. Both clients append to the
 * same archives, so if they built imports differently the divergence would show up as
 * duplicated or unmatched messages after a merge, months later and on someone else's device.
 * Two copies of forty lines is the cheaper failure mode than a shared module that has to be
 * isomorphic; if a third client appears, move it into `core`.
 *
 * A message whose file `linkMedia` could not find keeps `attachment.sha256` unset. It still
 * merges in as an `attachment`-kind message — so a contributor who *does* have the file can
 * complete it later, since `pickCanonical` ranks `attachment` above `omitted-media` — and the
 * reader simply renders no image for it.
 */

import {
  linkMedia,
  type ArchiveParticipant,
  type CryptoProvider,
  type MediaBlob,
  type MediaLinkResult,
  type MediaSource,
  type MessageBatch,
  type ParsedMessage,
  type ParseResult,
} from "@chatvault/core";

export interface BuiltImport {
  readonly batch: MessageBatch;
  readonly media: readonly MediaBlob[];
  readonly participants: readonly ArchiveParticipant[];
  readonly link: MediaLinkResult;
  /** The batch's messages, with hashes stamped in — what the Verify screen must count. */
  readonly messages: readonly ParsedMessage[];
}

export async function buildImport(
  result: ParseResult,
  source: MediaSource,
  crypto: CryptoProvider,
  sourceId: string,
): Promise<BuiltImport> {
  const link = await linkMedia(result.messages, source, crypto);

  const messages = result.messages.map((message) => {
    if (message.kind !== "attachment" || !message.attachment) return message;
    const sha256 = link.byMessageId.get(message.id);
    if (sha256 === undefined) return message;
    return { ...message, attachment: { ...message.attachment, sha256 } };
  });

  const filenames = new Set(
    messages
      .filter((m) => m.kind === "attachment" && m.attachment?.sha256 !== undefined)
      .map((m) => m.attachment!.filename),
  );

  const media: MediaBlob[] = [];
  for (const filename of filenames) {
    media.push({ filename, bytes: await source.read(filename) });
  }

  const participants: ArchiveParticipant[] = result.participants.map((name) => ({
    id: name,
    displayName: name,
    // The alias map that reconciles "Dana" with "+972 50-123-4567" has to be populated by the
    // UI (`packages/core/CLAUDE.md`, known limitations). Seeding it with the name as written
    // is the honest starting point; guessing is what core refuses to do.
    aliases: [name],
  }));

  return { batch: { sourceId, messages }, media, participants, link, messages };
}
