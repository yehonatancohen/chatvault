import type { MergedMessage } from "../merge.js";

/**
 * The whole chat as plain text, for `chat.txt` in unprotected archives.
 *
 * It exists so that a copy of a chat in the user's Drive is readable without this app — open
 * the folder, open `chat.txt`, read. It is written, never read back: the chunks are the source
 * of truth, and this is regenerated from them on every import.
 *
 * The shape is close to WhatsApp's own export on purpose, so it looks familiar:
 *
 * ```
 * 15/03/2024, 09:00 - Dana: See you there
 * 15/03/2024, 09:02 - Ravid: [photo: media/3fa9….jpg] Look at this
 * 15/03/2024, 09:05 - Messages and calls are end-to-end encrypted.
 * ```
 *
 * The time is the wall clock the export printed, not a reformatted timestamp: the reader is
 * checking this against memory, and a time shifted by a timezone guess would be a lie.
 */
export function renderTranscript(
  chatTitle: string,
  messages: readonly MergedMessage[],
  mediaPaths: ReadonlyMap<string, string>,
): string {
  const lines = [chatTitle, ""];
  for (const message of messages) {
    const when = formatWallClock(message.wallClock);
    const who = message.sender !== null ? `${message.sender}: ` : "";
    lines.push(`${when} - ${who}${describe(message, mediaPaths)}`.trimEnd());
  }
  return `${lines.join("\n")}\n`;
}

function describe(message: MergedMessage, mediaPaths: ReadonlyMap<string, string>): string {
  switch (message.kind) {
    case "attachment": {
      const sha = message.attachment?.sha256;
      const path = sha !== undefined ? mediaPaths.get(sha) : undefined;
      const name = message.attachment?.filename ?? "file";
      const tag = path !== undefined ? `[${kindOf(name)}: ${path}]` : `[${kindOf(name)} not saved: ${name}]`;
      return message.body.length > 0 ? `${tag} ${message.body}` : tag;
    }
    case "omitted-media":
      return message.body.length > 0 ? `[media not saved] ${message.body}` : "[media not saved]";
    case "deleted":
      return "[deleted message]";
    default:
      return message.body;
  }
}

function kindOf(filename: string): string {
  const ext = /\.([A-Za-z0-9]+)$/.exec(filename)?.[1]?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext)) return "photo";
  if (["mp4", "mov", "3gp", "m4v"].includes(ext)) return "video";
  if (["opus", "m4a", "mp3", "aac", "ogg", "wav"].includes(ext)) return "audio";
  return "file";
}

/** `2024-03-15T09:00:00` → `15/03/2024, 09:00`. Anything unexpected is passed through as-is. */
function formatWallClock(wallClock: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wallClock);
  return match ? `${match[3]}/${match[2]}/${match[1]}, ${match[4]}:${match[5]}` : wallClock;
}
