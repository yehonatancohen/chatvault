/**
 * Photo previews on the phone, for `ArchiveWriter.addMissingThumbnails`.
 *
 * `expo-image-manipulator` decodes natively (including HEIC), shrinks to at most `WIDTH` pixels
 * wide and re-encodes as JPEG — a few tens of kilobytes per photo. Previews stay on the phone
 * after the full photos move to Drive, which is what keeps galleries instant and offline.
 *
 * The manipulator works on files, so each photo passes through a temporary file in the cache
 * directory, deleted every time.
 */

import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { Thumbnailer } from "@chatvault/core";

const WIDTH = 360;

export const makeThumbnail: Thumbnailer = async (bytes, filename) => {
  const ext = /\.([A-Za-z0-9]+)$/.exec(filename)?.[1]?.toLowerCase() ?? "jpg";
  const source = new File(Paths.cache, `preview-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  let output: File | undefined;
  try {
    source.write(bytes);
    const decoded = await ImageManipulator.manipulate(source.uri).renderAsync();
    // Never enlarge: a sticker or a small image is already preview-sized.
    const image =
      decoded.width > WIDTH
        ? await ImageManipulator.manipulate(decoded).resize({ width: WIDTH }).renderAsync()
        : decoded;
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    output = new File(saved.uri);
    return await output.bytes();
  } catch {
    return undefined; // not an image the platform can decode; the gallery shows the full photo
  } finally {
    try {
      if (source.exists) source.delete();
      if (output?.exists) output.delete();
    } catch {
      // The cache directory is the system's to reap.
    }
  }
};
