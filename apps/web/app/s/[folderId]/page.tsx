"use client";

import { use, useEffect, useState } from "react";
import type { ArchiveReader, MergedMessage } from "@chatvault/core";
import { MessageList } from "../../_components/MessageList";
import { GetTheApp } from "../../_components/GetTheApp";
import { openSharedChat } from "../../../lib/shared-chat";

type Stage =
  | { readonly kind: "loading" }
  | { readonly kind: "viewing"; readonly reader: ArchiveReader; readonly messages: MergedMessage[] }
  | { readonly kind: "error"; readonly message: string };

/**
 * A chat someone sent you. Read it here; save your own with the app.
 *
 * Client-only: a protected chat's key is in the URL fragment, which only the browser can see.
 */
export default function SharedChatPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = use(params);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  useEffect(() => {
    let stale = false;
    openSharedChat(folderId, window.location.hash)
      .then(async (reader) => {
        const messages = await reader.readAll();
        if (!stale) setStage({ kind: "viewing", reader, messages });
      })
      .catch((error: unknown) => {
        if (!stale) setStage({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      stale = true;
    };
  }, [folderId]);

  if (stage.kind !== "viewing") {
    return (
      <main className="shared-status" dir="auto">
        {stage.kind === "loading" ? <p>פותח את הצ׳אט…</p> : <p className="open-error">{stage.message}</p>}
        <GetTheApp />
      </main>
    );
  }

  const { manifest } = stage.reader;
  return (
    <div className="open-shell">
      <header className="viewer-header">
        <div>
          <div className="viewer-title">{manifest.chatTitle || "צ׳אט"}</div>
          <div className="viewer-subtitle">
            {manifest.messageCount.toLocaleString("he-IL")} הודעות · {manifest.participants.length} משתתפים
          </div>
        </div>
        <div className="viewer-actions">
          <GetTheApp compact />
        </div>
      </header>
      <div className="viewer-body">
        <MessageList messages={stage.messages} reader={stage.reader} />
      </div>
    </div>
  );
}
