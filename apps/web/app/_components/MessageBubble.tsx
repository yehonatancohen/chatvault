"use client";

import type { ArchiveReader, MergedMessage } from "@chatvault/core";
import { MediaAttachment } from "./MediaAttachment";
import { colorForParticipant, messageTime } from "../../lib/chat";

interface MessageBubbleProps {
  readonly message: MergedMessage;
  readonly reader: ArchiveReader;
  /** First of a run by one sender: the bubble that carries the name. */
  readonly startsGroup: boolean;
  /** Last of a run: the bubble that carries the tail corner. */
  readonly endsGroup: boolean;
  /** The reader said this participant is them, so their messages sit on the other side. */
  readonly isSelf: boolean;
  readonly onOpenLightbox: (url: string, filename: string) => void;
}

/**
 * One message, as a chat bubble — the web counterpart of the app's `MessageBubble`, and
 * deliberately the same shape: a name once per run, a stable colour per speaker, the time in
 * the corner, and media that says so when the archive does not hold it.
 *
 * **`unicodeBidi: "plaintext"` is what makes this RTL-correct without a language heuristic of
 * our own**: the browser takes each message's direction from its own first strong character, so
 * a Hebrew message and an English one in the same conversation each render the way they were
 * typed. Root CLAUDE.md calls this out — Hebrew/RTL exports are the common case here.
 */
export function MessageBubble({
  message,
  reader,
  startsGroup,
  endsGroup,
  isSelf,
  onOpenLightbox,
}: MessageBubbleProps) {
  if (message.kind === "system") {
    return (
      <div className="bubble-row bubble-row-system">
        <div className="bubble-system" style={{ unicodeBidi: "plaintext" }}>
          {message.body}
        </div>
      </div>
    );
  }

  const sender = message.sender ?? "לא ידוע";
  const showName = startsGroup && !isSelf;

  return (
    <div
      className={[
        "bubble-row",
        isSelf ? "bubble-row-self" : "bubble-row-other",
        endsGroup ? "bubble-row-end" : "",
      ].join(" ")}
    >
      <div className={["bubble", isSelf ? "bubble-self" : "bubble-other", endsGroup ? "bubble-tail" : ""].join(" ")}>
        {showName && (
          <div className="bubble-sender" style={{ color: colorForParticipant(sender), unicodeBidi: "plaintext" }}>
            {sender}
          </div>
        )}

        {message.kind === "attachment" && message.attachment?.sha256 !== undefined && (
          <MediaAttachment
            reader={reader}
            filename={message.attachment.filename}
            sha256={message.attachment.sha256}
            onOpenLightbox={onOpenLightbox}
          />
        )}

        {message.kind === "attachment" && message.attachment?.sha256 === undefined && (
          <div className="bubble-absent">הקובץ לא נכלל בגיבוי</div>
        )}

        {message.kind === "omitted-media" && <div className="bubble-absent">מדיה שלא נשמרה בארכיון</div>}

        {message.kind === "deleted" && <div className="bubble-deleted">ההודעה נמחקה</div>}

        {message.body.length > 0 && (
          <div className="bubble-body" style={{ unicodeBidi: "plaintext" }}>
            {message.body}
          </div>
        )}

        <div className="bubble-time">{messageTime(message.ts)}</div>
      </div>
    </div>
  );
}
