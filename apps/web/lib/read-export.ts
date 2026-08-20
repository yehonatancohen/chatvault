/**
 * Reading a raw WhatsApp export (the file WhatsApp itself produces) — not a `.cvault` bundle.
 * A text-only export is one `.txt` file; a with-media export is a `.zip` with `_chat.txt` and
 * the media flat beside it (root CLAUDE.md, "What a real export actually looks like" #6).
 *
 * This is the browser's `MediaSource` implementation: `apps/web/CLAUDE.md` says
 * `InMemoryMediaSource` is the right choice here because the browser has already decoded the
 * zip entries, and that `list()` must filter out the transcript and OS debris itself — core
 * does not know those names.
 */

import { unzip } from "fflate";
import { InMemoryMediaSource } from "@chatvault/core";

export interface RawExport {
  readonly text: string;
  readonly media: InMemoryMediaSource;
}

export async function readWhatsAppExport(file: File): Promise<RawExport> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".zip")) {
    return { text: await file.text(), media: new InMemoryMediaSource() };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
  });

  let chatText: string | undefined;
  const mediaEntries: [string, Uint8Array][] = [];
  const decoder = new TextDecoder();

  for (const [path, data] of Object.entries(entries)) {
    const base = path.split("/").pop() ?? path;
    if (isJunk(path, base)) continue;

    if (base.toLowerCase().endsWith(".txt")) {
      if (chatText === undefined) chatText = decoder.decode(data);
      continue;
    }
    mediaEntries.push([base, data]);
  }

  if (chatText === undefined) {
    throw new Error("No chat transcript (_chat.txt) found in this export.");
  }

  return { text: chatText, media: new InMemoryMediaSource(mediaEntries) };
}

function isJunk(path: string, base: string): boolean {
  if (path.startsWith("__MACOSX/")) return true;
  if (base === ".DS_Store") return true;
  if (base.toLowerCase() === "thumbs.db") return true;
  return false;
}
