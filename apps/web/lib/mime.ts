/** `MediaRef` carries no MIME type (see `archive/format.ts`) — inferred here from the filename. */

const BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  "3gp": "video/3gpp",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  pdf: "application/pdf",
};

export function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? "application/octet-stream";
}

export type MediaClass = "image" | "video" | "audio" | "other";

export function mediaClassOf(mime: string): MediaClass {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "other";
}
