"use client";

import { describeMessage, formatText, type ArchiveReader, type MergedMessage, type MessageView } from "@chatvault/core";
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
  readonly onOpenLightbox: (url: string, filename: string, owned: boolean) => void;
}

/**
 * One message, as a chat bubble — the web counterpart of the app's `MessageBubble`, and
 * deliberately the same shape: a name once per run, a stable colour per speaker, the time in
 * the corner, and media that says so when the archive does not hold it.
 *
 * **What a message *is* comes from `describeMessage` in core**, the same reading the app uses:
 * an export flattens a poll, a place, a call or an edit into lines of text, and this draws
 * them as what they were. Nothing here inspects `message.body` on its own.
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
  const view = describeMessage(message);

  if (view.type === "notice") {
    return (
      <div className="bubble-row bubble-row-system">
        <div className="bubble-system" style={{ unicodeBidi: "plaintext" }}>
          {view.text}
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
          <div className="bubble-sender" style={{ color: colorForParticipant(sender) }}>
            <bdi>{sender}</bdi>
          </div>
        )}

        <Content view={view} message={message} reader={reader} onOpenLightbox={onOpenLightbox} />

        <div className="bubble-meta">
          {view.edited && <span className="bubble-edited">נערכה</span>}
          <span className="bubble-time">{messageTime(message.ts)}</span>
        </div>
      </div>
    </div>
  );
}

function Content({
  view,
  message,
  reader,
  onOpenLightbox,
}: {
  view: MessageView;
  message: MergedMessage;
  reader: ArchiveReader;
  onOpenLightbox: MessageBubbleProps["onOpenLightbox"];
}) {
  switch (view.type) {
    case "text":
      return <Rich text={view.text} />;

    case "deleted":
      return <div className="bubble-deleted">ההודעה נמחקה</div>;

    case "unavailable":
      return <div className="bubble-absent">הודעה ש־WhatsApp לא כלל בייצוא</div>;

    case "media": {
      const sha256 = message.attachment?.sha256;
      return (
        <>
          {view.filename !== undefined && sha256 !== undefined ? (
            <MediaAttachment
              reader={reader}
              filename={view.filename}
              sha256={sha256}
              media={view.media}
              title={view.title}
              detail={view.detail}
              onOpenLightbox={onOpenLightbox}
            />
          ) : (
            <div className="bubble-absent">
              {view.title !== undefined && (
                <>
                  <bdi>{view.title}</bdi>
                  {" · "}
                </>
              )}
              {view.filename !== undefined ? "הקובץ לא נכלל בגיבוי" : "מדיה שלא נשמרה בארכיון"}
            </div>
          )}
          {view.caption !== "" && <Rich text={view.caption} />}
        </>
      );
    }

    case "location":
      return (
        <div className="bubble-card">
          <span className="bubble-card-kind">{view.live ? "מיקום בזמן אמת" : "מיקום"}</span>
          {view.label !== undefined && (
            <span className="bubble-card-title" style={{ unicodeBidi: "plaintext" }}>
              {view.label}
            </span>
          )}
          {view.url !== undefined ? (
            // A plain link, opened only when clicked: no map is embedded, so nothing about this
            // chat reaches Google by looking at it.
            <a href={view.url} target="_blank" rel="noopener noreferrer">
              פתיחה במפות
            </a>
          ) : (
            <span className="bubble-card-kind">שיתוף המיקום הסתיים</span>
          )}
        </div>
      );

    case "poll": {
      const most = Math.max(1, ...view.options.map((option) => option.votes ?? 0));
      return (
        <div className="bubble-card">
          <span className="bubble-card-kind">סקר</span>
          <span className="poll-question" style={{ unicodeBidi: "plaintext" }}>
            {view.question}
          </span>
          {view.options.map((option, index) => (
            <div className="poll-option" key={index}>
              <div className="poll-option-row">
                <span style={{ unicodeBidi: "plaintext" }}>{option.text}</span>
                {option.votes !== null && <span className="poll-option-votes">{option.votes}</span>}
              </div>
              <div className="poll-bar">
                <span style={{ width: `${((option.votes ?? 0) / most) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "call":
      return (
        <div className={view.missed ? "bubble-call bubble-call-missed" : "bubble-call"}>
          <span aria-hidden="true">{view.video ? "📹" : "📞"}</span>
          <span>{callLabel(view)}</span>
        </div>
      );
  }
}

function callLabel(view: Extract<MessageView, { type: "call" }>): string {
  const what = view.video ? "שיחת וידאו" : "שיחה קולית";
  return `${what}${view.group ? " קבוצתית" : ""}${view.missed ? " שלא נענתה" : ""}`;
}

/** Text the way WhatsApp sets it: its emphasis marks applied, its links followable. */
function Rich({ text }: { text: string }) {
  return (
    <div className="bubble-body" style={{ unicodeBidi: "plaintext" }}>
      {formatText(text).map((span, index) => {
        let node: React.ReactNode = span.text;
        if (span.href !== undefined) {
          node = (
            <a href={span.href} target="_blank" rel="noopener noreferrer">
              {span.text}
            </a>
          );
        }
        if (span.code) node = <code>{node}</code>;
        if (span.strike) node = <s>{node}</s>;
        if (span.italic) node = <em>{node}</em>;
        if (span.bold) node = <strong>{node}</strong>;
        return <span key={index}>{node}</span>;
      })}
    </div>
  );
}
