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
  /** True while chunks older than what is on screen are still arriving from Drive. */
  readonly loadingOlder?: boolean | undefined;
}

/**
 * The virtual index the *last* row always sits just below.
 *
 * `firstItemIndex` is how Virtuoso is told that a list grew at the top rather than the bottom,
 * and it must stay positive. Deriving it as `PREPEND_BASE - rows.length` anchors the list to its
 * end: the newest row keeps the index `PREPEND_BASE - 1` for the whole session however many
 * older chunks arrive, so a reader mid-scroll stays exactly where they were. It also absorbs the
 * one case a plain counter gets wrong — a prepended chunk that merges into the run or the day
 * already at the top, which adds fewer rows than it has messages.
 */
const PREPEND_BASE = 1_000_000;

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
export function MessageList({ messages, reader, selfNames, loadingOlder = false }: MessageListProps) {
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
        firstItemIndex={Math.max(PREPEND_BASE - rows.length, 0)}
        initialTopMostItemIndex={{ index: "LAST", align: "end" }}
        computeItemKey={(_index, row) => row.key}
        atBottomThreshold={140}
        atBottomStateChange={setAtBottom}
        increaseViewportBy={{ top: 600, bottom: 600 }}
        {...(loadingOlder ? { components: { Header: OlderLoading } } : {})}
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
          onClick={() => virtuoso.current?.scrollToIndex({ index: "LAST", align: "end" })}
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

/**
 * The strip above the oldest message that has arrived so far.
 *
 * It is a statement about the archive, not a warning: the conversation continues further back
 * and is still coming down. Once the last chunk lands the strip is gone, and the top of the
 * list is the true beginning of the chat.
 */
function OlderLoading() {
  return (
    <div className="older-loading" dir="auto">
      <span className="older-loading-dot" aria-hidden="true" />
      טוענים הודעות קודמות…
    </div>
  );
}
