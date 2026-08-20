"use client";

import { useState } from "react";
import { ArchiveReader, ArchiveWriter, createWebCryptoProvider, parseExport } from "@chatvault/core";
import { readWhatsAppExport } from "../../lib/read-export";
import { buildImport } from "../../lib/build-import";
import type { OpenedArchive } from "../../lib/open-archive";

interface AppendPanelProps {
  readonly opened: OpenedArchive;
  readonly onAppended: (next: OpenedArchive) => void;
}

type State =
  | { readonly status: "idle" }
  | { readonly status: "working" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "done"; readonly added: number; readonly total: number };

/**
 * Client-side append-and-merge (`ROADMAP.md` B3). The uploaded export is parsed and merged
 * entirely in this tab — `apps/web/CLAUDE.md`: "The uploaded export must never be sent to a
 * server; that would break invariant 2 for the one flow where it is most tempting to cheat."
 */
export function AppendPanel({ opened, onAppended }: AppendPanelProps) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleFile(file: File) {
    setState({ status: "working" });
    try {
      const { storage, reader, key } = opened;
      const crypto = createWebCryptoProvider(window.crypto.subtle, (a) =>
        window.crypto.getRandomValues(a),
      );

      const { text, media } = await readWhatsAppExport(file);
      const parsed = parseExport(text, { tzOffsetMinutes: 0 });

      const sourceId = window.crypto.randomUUID();
      const built = await buildImport(parsed, media, crypto, sourceId);

      const beforeCount = reader.manifest.messageCount;

      const writer = new ArchiveWriter({
        crypto,
        storage,
        key,
        archiveId: reader.header.archiveId,
        keyWrapping: reader.header.keyWrapping,
      });

      const manifest = await writer.append({
        chatTitle: reader.manifest.chatTitle,
        participants: built.participants,
        sources: [
          {
            id: sourceId,
            contributor: null,
            tzOffsetMinutes: 0,
            importedAt: Date.now(),
            dialect: parsed.dialect,
          },
        ],
        batches: [built.batch],
        media: built.media,
      });

      const nextReader = await ArchiveReader.open({
        crypto,
        storage,
        key,
        archiveId: reader.header.archiveId,
      });

      setState({
        status: "done",
        added: manifest.messageCount - beforeCount,
        total: manifest.messageCount,
      });
      onAppended({ storage, reader: nextReader, key });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="append-panel">
      <strong>Add your export</strong>
      <p style={{ margin: "0.25rem 0" }}>
        Drop in your own copy of this chat&apos;s export (.zip or .txt). New messages merge in;
        anything already here is left untouched.
      </p>
      <input
        type="file"
        accept=".zip,.txt"
        disabled={state.status === "working"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      {state.status === "working" && <p>Parsing and merging in this tab…</p>}
      {state.status === "error" && <p className="append-error">{state.message}</p>}
      {state.status === "done" && (
        <p className="append-summary">
          Added {state.added} new message{state.added === 1 ? "" : "s"}. The archive now holds{" "}
          {state.total} total.
        </p>
      )}
    </div>
  );
}
