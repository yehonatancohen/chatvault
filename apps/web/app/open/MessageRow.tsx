"use client";

import type { ArchiveReader, MergedMessage } from "@chatvault/core";
import { MediaAttachment } from "./MediaAttachment";

interface MessageRowProps {
  readonly message: MergedMessage;
  readonly reader: ArchiveReader;
  readonly onOpenLightbox: (url: string, filename: string) => void;
}

/**
 * `unicodeBidi: "plaintext"` is what makes this RTL-correct without a language heuristic of
 * our own: the browser picks each message's direction from its own first strong character,
 * so a Hebrew message and an English message next to each other in the same chat each render
 * the way they were typed. Root CLAUDE.md calls this out explicitly — Hebrew/RTL exports are
 * the common case here, not an edge case.
 */
export function MessageRow({ message, reader, onOpenLightbox }: MessageRowProps) {
  const time = formatTime(message.ts);

  if (message.kind === "system") {
    return (
      <div className="message-row message-system" style={{ unicodeBidi: "plaintext" }}>
        {message.body}
      </div>
    );
  }

  return (
    <div className="message-row">
      <div className="message-meta">
        <span className="message-sender">{message.sender ?? "Unknown"}</span>
        <span className="message-time">{time}</span>
      </div>

      {message.kind === "attachment" && message.attachment?.sha256 !== undefined && (
        <MediaAttachment
          reader={reader}
          filename={message.attachment.filename}
          sha256={message.attachment.sha256}
          onOpenLightbox={onOpenLightbox}
        />
      )}

      {message.kind === "omitted-media" && (
        <div className="message-body message-omitted" style={{ unicodeBidi: "plaintext" }}>
          {message.attachment?.filename ?? "Media"} — not captured in this archive
        </div>
      )}

      {message.kind === "deleted" && (
        <div className="message-body message-deleted" style={{ unicodeBidi: "plaintext" }}>
          This message was deleted
        </div>
      )}

      {message.kind === "text" && (
        <div className="message-body" style={{ unicodeBidi: "plaintext" }}>
          {message.body}
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
