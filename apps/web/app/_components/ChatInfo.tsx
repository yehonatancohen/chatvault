"use client";

import { useEffect, useMemo } from "react";
import { mediaStats, type ArchiveReader, type MergedMessage } from "@chatvault/core";
import { colorForParticipant, countLabel, formatBytes, formatRange } from "../../lib/chat";

interface ChatInfoProps {
  readonly reader: ArchiveReader;
  readonly messages: readonly MergedMessage[];
  /** Participant id the reader picked as themselves, if any. */
  readonly selfId: string | undefined;
  readonly onPickSelf: (participantId: string | undefined) => void;
  readonly onClose: () => void;
}

/**
 * Chat info — who is in this conversation, how far back it reaches, how much it holds.
 *
 * The app has this screen (`apps/mobile/app/archive/[id]/info.tsx`) and a shared chat needs it
 * for the same reason: a group of sixty people is unreadable without a list of who they are,
 * and a reader deciding whether to keep a copy wants to know what "keeping it" costs — hence
 * the size, which is the same number the app now shows per chat.
 *
 * **Picking yourself** is the one thing here that changes the chat: a WhatsApp export never says
 * which participant the reader is, so until they say, every message sits on the same side. It is
 * remembered per chat in this browser only (`localStorage`) — a display preference about someone
 * else's archive has no business being written into it.
 */
export function ChatInfo({ reader, messages, selfId, onPickSelf, onClose }: ChatInfoProps) {
  const { manifest } = reader;
  const stats = useMemo(() => mediaStats(manifest.media, messages), [manifest.media, messages]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = manifest.chatTitle || "צ׳אט";

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <aside className="sheet" onClick={(event) => event.stopPropagation()} aria-label="מידע על הצ׳אט">
        <header className="sheet-head">
          <div className="sheet-title">מידע על הצ׳אט</div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="סגירה">
            ✕
          </button>
        </header>

        <div className="sheet-body">
          <div className="info-hero">
            <div className="info-avatar" style={{ backgroundColor: colorForParticipant(title) }}>
              {[...title][0]?.toUpperCase() ?? "?"}
            </div>
            <div className="info-name" style={{ unicodeBidi: "plaintext" }}>
              {title}
            </div>
            <div className="info-sub">
              {countLabel(manifest.participants.length, "משתתף אחד", "משתתפים")} ·{" "}
              {countLabel(manifest.messageCount, "הודעה אחת", "הודעות")}
            </div>
          </div>

          <dl className="info-facts">
            <div>
              <dt>טווח</dt>
              <dd>{formatRange(manifest.firstTs, manifest.lastTs)}</dd>
            </div>
            <div>
              <dt>מדיה</dt>
              <dd>
                {countLabel(stats.uniqueBlobCount, "קובץ אחד", "קבצים")} · {formatBytes(stats.totalBytes)}
              </dd>
            </div>
            {stats.notArchivedCount > 0 && (
              <div>
                <dt>לא נשמר</dt>
                {/* The count of media the archive does not hold, stated plainly and never as a
                    warning — it is ordinary (root CLAUDE.md: WhatsApp omits media it no longer
                    has), and it is exactly what a reader checking this archive needs to know. */}
                <dd>{countLabel(stats.notArchivedCount, "קובץ מדיה אחד חסר", "קבצי מדיה חסרים")} בארכיון</dd>
              </div>
            )}
            <div>
              <dt>סיסמת מעבר</dt>
              <dd>{reader.encrypted ? "מוגן" : "ללא"}</dd>
            </div>
          </dl>

          <div className="info-people">
            <div className="info-section-title">משתתפים</div>
            <p className="info-hint">בחרו מי מהם אתם, וההודעות שלכם יעברו לצד שלכם.</p>
            {manifest.participants.map((participant) => {
              const isSelf = participant.id === selfId;
              return (
                <button
                  key={participant.id}
                  type="button"
                  className={isSelf ? "person person-self" : "person"}
                  aria-pressed={isSelf}
                  onClick={() => onPickSelf(isSelf ? undefined : participant.id)}
                >
                  <span className="person-avatar" style={{ backgroundColor: colorForParticipant(participant.displayName) }}>
                    {[...participant.displayName][0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="person-name" style={{ unicodeBidi: "plaintext" }}>
                    {participant.displayName}
                  </span>
                  {isSelf && <span className="person-you">אתם</span>}
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
