/**
 * Photos as image URIs, preview first.
 *
 * Galleries, avatars and chat bubbles draw the small preview (`ArchiveReader.readThumbnail`) —
 * kept on the phone, so instant and offline — and fall back to the full photo only when a chat
 * has no preview for it. The full photo (possibly fetched from Drive) is loaded when someone
 * actually opens it.
 */

import type { ArchiveReader } from "@chatvault/core";
import { toBase64 } from "../crypto/base64";
import { mimeTypeOf } from "./mime";

export async function previewUri(
  reader: ArchiveReader,
  sha256: string,
  filename: string,
): Promise<{ readonly uri: string; readonly isFull: boolean }> {
  const preview = await reader.readThumbnail(sha256).catch(() => undefined);
  if (preview !== undefined) return { uri: `data:image/jpeg;base64,${toBase64(preview)}`, isFull: false };
  return { uri: await fullUri(reader, sha256, filename), isFull: true };
}

export async function fullUri(reader: ArchiveReader, sha256: string, filename: string): Promise<string> {
  const bytes = await reader.readMedia(sha256);
  return `data:${mimeTypeOf(filename)};base64,${toBase64(bytes)}`;
}
