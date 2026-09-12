"use client";

import { use, useEffect, useMemo, useState } from "react";
import type { MergedMessage } from "@chatvault/core";
import { MessageList } from "../../_components/MessageList";
import { ChatInfo } from "../../_components/ChatInfo";
import { SaveChat } from "../../_components/SaveChat";
import { AppBanner } from "../../_components/AppBanner";
import { GetTheApp } from "../../_components/GetTheApp";
import { colorForParticipant, countLabel } from "../../../lib/chat";
import { openSharedChat, type SharedChat } from "../../../lib/shared-chat";
import { GOOGLE_CLIENT_ID } from "../../../lib/site";

type Stage =
  | { readonly kind: "loading" }
  | { readonly kind: "viewing"; readonly chat: SharedChat; readonly messages: MergedMessage[] }
  | { readonly kind: "error"; readonly message: string };

/**
 * A chat someone sent you. Read it here; keep your own copy with two taps.
 *
 * Client-only: a protected chat's key is in the URL fragment, which only the browser can see.
 * Nothing on this page may serialize `location` — see `apps/web/CLAUDE.md`, "The rule for pages
 * that carry a key". That is also why the Drive connection happens in a separate window at
 * `/connect` rather than through a Google script loaded here.
 */
export default function SharedChatPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = use(params);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [panel, setPanel] = useState<"none" | "info" | "save">("none");
  const [selfId, setSelfId] = useState<string | undefined>(undefined);

  const selfKey = `boydem.self.${folderId}`;

  useEffect(() => {
    let stale = false;
    openSharedChat(folderId, window.location.hash)
      .then(async (chat) => {
        const messages = await chat.reader.readAll();
        if (!stale) setStage({ kind: "viewing", chat, messages });
      })
      .catch((error: unknown) => {
        if (!stale) setStage({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      stale = true;
    };
  }, [folderId]);

  useEffect(() => {
    try {
      setSelfId(window.localStorage.getItem(selfKey) ?? undefined);
    } catch {
      setSelfId(undefined);
    }
  }, [selfKey]);

  const participants = stage.kind === "viewing" ? stage.chat.reader.manifest.participants : [];
  const selfNames = useMemo(() => {
    const self = participants.find((participant) => participant.id === selfId);
    return self === undefined ? undefined : new Set([self.displayName, ...self.aliases]);
  }, [participants, selfId]);

  function pickSelf(participantId: string | undefined): void {
    setSelfId(participantId);
    try {
      if (participantId === undefined) window.localStorage.removeItem(selfKey);
      else window.localStorage.setItem(selfKey, participantId);
    } catch {
      // A browser that refuses storage still gets the choice for this visit.
    }
  }

  if (stage.kind !== "viewing") {
    return (
      <main className="shared-status" dir="auto">
        {stage.kind === "loading" ? <p>פותח את הצ׳אט…</p> : <p className="open-error">{stage.message}</p>}
        <GetTheApp />
      </main>
    );
  }

  const { manifest } = stage.chat.reader;
  const title = manifest.chatTitle || "צ׳אט";

  return (
    <div className="open-shell">
      <header className="viewer-header">
        <button type="button" className="viewer-identity" onClick={() => setPanel("info")}>
          <span className="viewer-avatar" style={{ backgroundColor: colorForParticipant(title) }}>
            {[...title][0]?.toUpperCase() ?? "?"}
          </span>
          <span className="viewer-identity-text">
            <span className="viewer-title" style={{ unicodeBidi: "plaintext" }}>
              {title}
            </span>
            <span className="viewer-subtitle">
              {countLabel(manifest.participants.length, "משתתף אחד", "משתתפים")} ·{" "}
              {countLabel(manifest.messageCount, "הודעה אחת", "הודעות")}
            </span>
          </span>
        </button>
        <div className="viewer-actions">
          {GOOGLE_CLIENT_ID !== "" && (
            <button type="button" className="viewer-save" onClick={() => setPanel("save")}>
              שמירה אצלי
            </button>
          )}
          <GetTheApp compact />
        </div>
      </header>

      <div className="viewer-body">
        <MessageList messages={stage.messages} reader={stage.chat.reader} selfNames={selfNames} />
      </div>

      <AppBanner />

      {panel === "info" && (
        <ChatInfo
          reader={stage.chat.reader}
          messages={stage.messages}
          selfId={selfId}
          onPickSelf={pickSelf}
          onClose={() => setPanel("none")}
        />
      )}
      {panel === "save" && <SaveChat chat={stage.chat} onClose={() => setPanel("none")} />}
    </div>
  );
}
