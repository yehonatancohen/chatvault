"use client";

import { useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { ArchiveReader, MergedMessage } from "@chatvault/core";
import { MessageBubble } from "./MessageBubble";
import { Lightbox } from "./Lightbox";
import { buildChatRows, daySeparatorLabel } from "../../lib/chat";

interface MessageListProps {
  readonly messages: readonly MergedMessage[];
  readonly reader: ArchiveReader;
  /**
   * Every name the participant the reader picked as themselves appears under — their display
   * name and its aliases. One person can be "Dana" in one member's export and a bare phone
   * number in another's (`Manifest.participants`), and matching only the display name would put
   * half of their own messages on the other side of the screen.
   */
  readonly selfNames?: ReadonlySet<string> | undefined;
}

interface LightboxState {
  readonly url: string;
  readonly filename: string;
}

/**
 * The conversation.
 *
 * Three things here are the difference between a chat and a table of rows, and each was asked
 * for by name:
 *
 * - **It opens at the end.** A conversation's last word is where you start reading, not its
 *   first. `initialTopMostItemIndex` puts the list there on first render rather than scrolling
 *   after layout, which is what avoids the flash of the oldest message.
 * - **A button back down.** Once you have scrolled up into an archive that reaches years back,
 *   getting back to the present must not be a swiping marathon — the same button WhatsApp has.
 * - **Day separators and grouped runs** (`lib/chat.ts`), so a hundred messages read as a few
 *   turns on a few days.
 *
 * `Virtuoso` handles variable-height rows itself — a one-line message next to a photo next to a
 * system notice — and archives run to tens of thousands of messages (root CLAUDE.md), so *some*
 * virtualization is not optional.
 */
export function MessageList({ messages, reader, selfNames }: MessageListProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const virtuoso = useRef<VirtuosoHandle>(null);

  const rows = useMemo(() => buildChatRows(messages), [messages]);

  return (
    <div className="chat-pane">
      <Virtuoso
        ref={virtuoso}
        style={{ height: "100%" }}
        data={rows}
        initialTopMostItemIndex={{ index: Math.max(rows.length - 1, 0), align: "end" }}
        computeItemKey={(_index, row) => row.key}
        atBottomThreshold={140}
        atBottomStateChange={setAtBottom}
        increaseViewportBy={{ top: 600, bottom: 600 }}
        itemContent={(_index, row) =>
          row.kind === "day" ? (
            <div className="day-row">
              <span className="day-chip">{daySeparatorLabel(row.ts)}</span>
            </div>
          ) : (
            <MessageBubble
              message={row.message}
              reader={reader}
              startsGroup={row.startsGroup}
              endsGroup={row.endsGroup}
              isSelf={row.message.sender !== null && selfNames?.has(row.message.sender) === true}
              onOpenLightbox={(url, filename) => setLightbox({ url, filename })}
            />
          )
        }
      />

      {!atBottom && rows.length > 0 && (
        <button
          type="button"
          className="jump-down"
          aria-label="לתחתית הצ׳אט"
          onClick={() => virtuoso.current?.scrollToIndex({ index: rows.length - 1, align: "end" })}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      {lightbox && (
        <Lightbox url={lightbox.url} filename={lightbox.filename} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
