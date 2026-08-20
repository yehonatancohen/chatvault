"use client";

import { useState } from "react";
import type { MergedMessage } from "@chatvault/core";
import { openBundle, type OpenedArchive } from "../../lib/open-archive";
import { MessageList } from "./MessageList";
import { AppendPanel } from "./AppendPanel";

type Stage =
  | { readonly kind: "pick"; readonly file?: File }
  | { readonly kind: "unlocking"; readonly file: File }
  | { readonly kind: "unlock-error"; readonly file: File; readonly message: string }
  | { readonly kind: "viewing"; readonly opened: OpenedArchive; readonly messages: readonly MergedMessage[] };

/**
 * The bundle-open flow (`ROADMAP.md` B0a). No backend, no archive id in the URL — the whole
 * archive arrives as a `.cvault` file the user picked up by AirDrop, email, or a Drive share,
 * and everything from here happens in this tab. See `apps/web/CLAUDE.md`: decryption is
 * client-only, and this page (and everything under it) is a Client Component for that reason.
 */
export default function OpenPage() {
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [passphrase, setPassphrase] = useState("");

  async function unlock(file: File, phrase: string) {
    setStage({ kind: "unlocking", file });
    try {
      const opened = await openBundle(file, phrase);
      const messages = await opened.reader.readAll();
      setStage({ kind: "viewing", opened, messages });
    } catch (error) {
      setStage({
        kind: "unlock-error",
        file,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function download(opened: OpenedArchive) {
    const blob = await opened.storage.toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${opened.reader.header.archiveId}.cvault`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (stage.kind === "viewing") {
    const { opened, messages } = stage;
    const { manifest } = opened.reader;
    return (
      <div className="open-shell">
        <header className="viewer-header">
          <div>
            <div className="viewer-title">{manifest.chatTitle || "Untitled chat"}</div>
            <div className="viewer-subtitle">
              {manifest.messageCount} messages · {manifest.participants.length} participants
            </div>
          </div>
          <div className="viewer-actions">
            <button type="button" onClick={() => void download(opened)}>
              Download updated bundle
            </button>
          </div>
        </header>

        <div className="viewer-body">
          <MessageList messages={messages} reader={opened.reader} />
        </div>

        <AppendPanel
          opened={opened}
          onAppended={async (next) => {
            const nextMessages = await next.reader.readAll();
            setStage({ kind: "viewing", opened: next, messages: nextMessages });
          }}
        />
      </div>
    );
  }

  const file = stage.file;
  const busy = stage.kind === "unlocking";

  return (
    <main className="open-picker">
      <h1>Open an archive</h1>
      <p>
        Pick a <code>.cvault</code> file someone shared with you and enter the passphrase it was
        created with. Nothing here is sent anywhere — the file is decrypted in this browser tab
        only.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (file) void unlock(file, passphrase);
        }}
      >
        <input
          type="file"
          accept=".cvault"
          disabled={busy}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) setStage({ kind: "pick", file: picked });
          }}
        />

        <label htmlFor="passphrase">Passphrase</label>
        <input
          id="passphrase"
          type="password"
          value={passphrase}
          disabled={busy}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="off"
        />

        <button type="submit" disabled={!file || busy}>
          {busy ? "Unlocking…" : "Open"}
        </button>
      </form>

      {stage.kind === "unlock-error" && stage.message && (
        <p className="open-error">{stage.message}</p>
      )}
    </main>
  );
}
