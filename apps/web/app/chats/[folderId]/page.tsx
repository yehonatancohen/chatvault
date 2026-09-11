"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArchiveReader, isPlainHeader, readHeader, type MergedMessage } from "@chatvault/core";
import { isSignedIn, prepareSignIn, signIn } from "../../../lib/google";
import { openDriveChat, webCrypto, type OpenedDriveChat } from "../../../lib/drive-chats";
import { unwrapArchiveKey } from "../../../lib/unwrap-key";
import { MessageList } from "../../open/MessageList";

type Stage =
  | { readonly kind: "signed-out" }
  | { readonly kind: "loading" }
  | { readonly kind: "passphrase"; readonly chat: Extract<OpenedDriveChat, { kind: "protected" }>; readonly error?: string }
  | { readonly kind: "viewing"; readonly reader: ArchiveReader; readonly messages: MergedMessage[] }
  | { readonly kind: "error"; readonly message: string };

/** One chat, read from its folder in the user's Google Drive. */
export default function DriveChatPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = use(params);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [passphrase, setPassphrase] = useState("");

  useEffect(() => {
    prepareSignIn();
    if (isSignedIn()) void open();
    else setStage({ kind: "signed-out" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  async function open() {
    setStage({ kind: "loading" });
    try {
      const chat = await openDriveChat(folderId);
      if (chat.kind === "protected") setStage({ kind: "passphrase", chat });
      else setStage({ kind: "viewing", reader: chat.reader, messages: await chat.reader.readAll() });
    } catch (error) {
      setStage({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function unlock(chat: Extract<OpenedDriveChat, { kind: "protected" }>) {
    try {
      const header = await readHeader(chat.storage, chat.archiveId);
      if (isPlainHeader(header)) return;
      const crypto = webCrypto();
      const key = await unwrapArchiveKey(header, passphrase, crypto);
      const reader = await ArchiveReader.open({ crypto, storage: chat.storage, key, archiveId: chat.archiveId });
      setStage({ kind: "viewing", reader, messages: await reader.readAll() });
    } catch (error) {
      setStage({ kind: "passphrase", chat, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (stage.kind === "viewing") {
    const { manifest } = stage.reader;
    return (
      <div className="open-shell">
        <header className="viewer-header">
          <div>
            <div className="viewer-title">{manifest.chatTitle || "Untitled chat"}</div>
            <div className="viewer-subtitle">
              {manifest.messageCount} messages · {manifest.participants.length} people
            </div>
          </div>
          <div className="viewer-actions">
            <Link href="/chats">All chats</Link>
          </div>
        </header>
        <div className="viewer-body">
          <MessageList messages={stage.messages} reader={stage.reader} />
        </div>
      </div>
    );
  }

  return (
    <main className="open-picker" dir="auto">
      <p>
        <Link href="/chats">← All chats</Link>
      </p>
      {stage.kind === "loading" && <p>Opening…</p>}
      {stage.kind === "signed-out" && (
        <button type="button" onClick={() => void signIn().then(open, () => undefined)}>
          Sign in with Google
        </button>
      )}
      {stage.kind === "error" && <p className="open-error">{stage.message}</p>}
      {stage.kind === "passphrase" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void unlock(stage.chat);
          }}
        >
          <label htmlFor="passphrase">This chat is protected. Passphrase:</label>
          <input
            id="passphrase"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="off"
          />
          <button type="submit" disabled={passphrase === ""}>
            Open
          </button>
          {stage.error !== undefined && <p className="open-error">{stage.error}</p>}
        </form>
      )}
    </main>
  );
}
