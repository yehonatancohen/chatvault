/**
 * Filename -> media type, for rendering an attachment.
 *
 * The archive stores blobs by content hash and keeps the filenames as aliases; nothing records
 * a MIME type, because nothing needed one until something had to display a photo. The
 * extension is all there is, which is fine — WhatsApp's own export names are machine-generated
 * (`00000043-PHOTO-2025-03-14-20-10-34.jpg`) and always carry one.
 */

export type MediaKind = "image" | "video" | "audio" | "other";

const IMAGE = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp"]);
const VIDEO = new Set(["mp4", "mov", "3gp", "mkv", "avi", "webm"]);
const AUDIO = new Set(["opus", "ogg", "m4a", "mp3", "aac", "wav", "amr"]);

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  opus: "audio/opus",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  pdf: "application/pdf",
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function mediaKindOf(filename: string): MediaKind {
  const extension = extensionOf(filename);
  if (IMAGE.has(extension)) return "image";
  if (VIDEO.has(extension)) return "video";
  if (AUDIO.has(extension)) return "audio";
  return "other";
}

/** `application/octet-stream` for anything unknown — never a guess that could mis-render. */
export function mimeTypeOf(filename: string): string {
  return MIME[extensionOf(filename)] ?? "application/octet-stream";
}
