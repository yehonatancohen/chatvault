"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** True when the URL was made for the lightbox alone, and is the lightbox's to release. */
  readonly owned: boolean;
}

/**
 * One `components` object for the life of the page. Handing Virtuoso a new object — or none —
 * when the older chunks finish does not take its header away again: the strip stayed above the
 * true beginning of the chat for good. Whether it shows is passed through `context` instead.
 */
const COMPONENTS = { Header: OlderLoading };

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

  const pane = useRef<HTMLDivElement>(null);
  /** True until the reader themselves scrolls away from the end. */
  const stick = useRef(true);
  const lastInput = useRef(0);

  const rows = useMemo(() => buildChatRows(messages), [messages]);

  const toEnd = useCallback((): void => {
    const handle = virtuoso.current;
    handle?.scrollToIndex({ index: "LAST", align: "end" });
    // `scrollToIndex` aims from the heights it has, and the last rows are often measured only
    // once they are on screen — it lands a few lines short and nothing fires again to correct
    // it. The frame after, the real heights are in, and the end is simply as far as it scrolls.
    requestAnimationFrame(() => handle?.scrollTo({ top: Number.MAX_SAFE_INTEGER }));
  }, []);

  // **Someone reading the end stays at the end.** The list opens at its last message, and then
  // the ground moves under it: the app strip mounts below and shortens the pane, a phone's
  // address bar slides away, older chunks are prepended and their estimated heights are
  // corrected, previews load. Each of those left the newest message somewhere between a few
  // lines and several screens out of view, with the jump button showing on a chat nobody had
  // touched. So leaving the end only counts when a person did it — a wheel, a finger, a key —
  // and anything else that pushes the list off its end is answered by going back there.
  const onAtBottom = useCallback(
    (value: boolean): void => {
      if (value) stick.current = true;
      else if (performance.now() - lastInput.current < 1000) stick.current = false;
      else if (stick.current) {
        requestAnimationFrame(toEnd);
        return; // still at the end as far as the reader is concerned: no jump button
      }
      setAtBottom(value);
    },
    [toEnd],
  );

  useEffect(() => {
    const element = pane.current;
    if (element === null) return;
    const touched = (): void => {
      lastInput.current = performance.now();
    };
    const events = ["wheel", "touchstart", "touchmove", "pointerdown", "keydown"] as const;
    for (const name of events) element.addEventListener(name, touched, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            if (stick.current) toEnd();
          });
    observer?.observe(element);
    return () => {
      for (const name of events) element.removeEventListener(name, touched);
      observer?.disconnect();
    };
  }, [toEnd]);

  const closeLightbox = useCallback((): void => {
    setLightbox((current) => {
      if (current?.owned === true) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  return (
    <div className="chat-pane" ref={pane}>
      <Virtuoso
        ref={virtuoso}
        style={{ height: "100%" }}
        data={rows}
        firstItemIndex={Math.max(PREPEND_BASE - rows.length, 0)}
        initialTopMostItemIndex={{ index: "LAST", align: "end" }}
        computeItemKey={(_index, row) => row.key}
        atBottomThreshold={140}
        atBottomStateChange={onAtBottom}
        increaseViewportBy={{ top: 600, bottom: 600 }}
        totalListHeightChanged={() => {
          if (stick.current) requestAnimationFrame(toEnd);
        }}
        context={{ loadingOlder }}
        components={COMPONENTS}
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
              onOpenLightbox={(url, filename, owned) => setLightbox({ url, filename, owned })}
            />
          )
        }
      />

      {!atBottom && rows.length > 0 && (
        <button
          type="button"
          className="jump-down"
          aria-label="לתחתית הצ׳אט"
          onClick={() => {
            stick.current = true;
            toEnd();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      {lightbox && (
        <Lightbox url={lightbox.url} filename={lightbox.filename} onClose={closeLightbox} />
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
function OlderLoading({ context }: { context?: { loadingOlder: boolean } }) {
  if (context?.loadingOlder !== true) return null;
  return (
    <div className="older-loading" role="status">
      <span className="older-loading-dot" aria-hidden="true" />
      טוענים הודעות קודמות…
    </div>
  );
}
