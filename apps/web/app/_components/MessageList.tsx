"use client";

import { useState } from "react";
import { Virtuoso } from "react-virtuoso";
import type { ArchiveReader, MergedMessage } from "@chatvault/core";
import { MessageRow } from "./MessageRow";
import { Lightbox } from "./Lightbox";

interface MessageListProps {
  readonly messages: readonly MergedMessage[];
  readonly reader: ArchiveReader;
}

interface LightboxState {
  readonly url: string;
  readonly filename: string;
}

/**
 * `Virtuoso` handles variable-height rows itself — a chat has text one-liners next to photos
 * next to system notices, so a fixed-row virtualizer (the simpler kind) would either clip
 * content or force every row to the height of its tallest possible content. Archives run to
 * tens of thousands of messages (root CLAUDE.md), so *some* virtualization is not optional.
 */
export function MessageList({ messages, reader }: MessageListProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  return (
    <>
      <Virtuoso
        style={{ height: "100%" }}
        data={messages}
        followOutput={false}
        itemContent={(_index, message) => (
          <MessageRow
            message={message}
            reader={reader}
            onOpenLightbox={(url, filename) => setLightbox({ url, filename })}
          />
        )}
      />
      {lightbox && (
        <Lightbox url={lightbox.url} filename={lightbox.filename} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
