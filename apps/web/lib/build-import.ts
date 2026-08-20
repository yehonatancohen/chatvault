/**
 * `ParseResult` + a `MediaSource` -> the two things `ArchiveWriter.append` actually wants: a
 * `MessageBatch` whose attachment messages carry a content hash, and the raw `MediaBlob[]` to
 * seal. `parseExport` never fills in `Attachment.sha256` — the doc comment on it says exactly
 * when that happens: "once the blob is read out of the export zip", which is this step.
 *
 * A message whose file `linkMedia` could not find is left with `attachment.sha256` unset. It
 * still merges in as an `attachment`-kind message (so a later contributor who *does* have the
 * file can complete it — `pickCanonical` ranks `attachment` above `omitted-media` regardless
 * of whether this copy resolved), but the viewer's `MessageRow` only renders `MediaAttachment`
 * once `sha256` is present, so an unresolved one simply shows nothing rather than erroring.
 */

import {
  linkMedia,
  type ArchiveParticipant,
  type CryptoProvider,
  type MediaBlob,
  type MediaLinkResult,
  type MediaSource,
  type MessageBatch,
  type ParseResult,
} from "@chatvault/core";

export interface BuiltImport {
  readonly batch: MessageBatch;
  readonly media: readonly MediaBlob[];
  readonly participants: readonly ArchiveParticipant[];
  readonly link: MediaLinkResult;
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
    aliases: [name],
  }));

  return {
    batch: { sourceId, messages },
    media,
    participants,
    link,
  };
}
