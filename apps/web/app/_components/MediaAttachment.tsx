"use client";

import { useEffect, useState } from "react";
import type { ArchiveReader } from "@chatvault/core";
import { mediaClassOf, mimeFromFilename } from "../../lib/mime";

interface MediaAttachmentProps {
  readonly reader: ArchiveReader;
  readonly filename: string;
  readonly sha256: string;
  readonly onOpenLightbox: (url: string, filename: string) => void;
}

type Load =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly url: string }
  | { readonly status: "error" };

/**
 * One attachment, loaded as late and as small as possible — a chat opened from Google Drive
 * downloads every byte it shows, so:
 *
 * - **Photos** draw their small preview (`readThumbnail`) inline and fetch the full photo only
 *   when opened. Chats without previews fall back to the full photo.
 * - **Videos, voice notes and files** load only when tapped: scrolling past a video must not
 *   download it.
 *
 * Object URLs are revoked on unmount so a long scroll session does not leak memory.
 */
export function MediaAttachment({ reader, filename, sha256, onOpenLightbox }: MediaAttachmentProps) {
  const mime = mimeFromFilename(filename);
  const kind = mediaClassOf(mime);
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (kind !== "image") return;
    let cancelled = false;
    let url: string | undefined;
    setLoad({ status: "loading" });
    (async () => {
      const preview = await reader.readThumbnail(sha256).catch(() => undefined);
      const bytes = preview ?? (await reader.readMedia(sha256));
      if (cancelled) return;
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: preview ? "image/jpeg" : mime }));
      setLoad({ status: "ready", url });
    })().catch(() => {
      if (!cancelled) setLoad({ status: "error" });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sha256]);

  async function loadFull(): Promise<string> {
    const bytes = await reader.readMedia(sha256);
    return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
  }

  if (kind === "image") {
    if (load.status === "error") return <div className="media-slot media-error">Could not load {filename}</div>;
    if (load.status !== "ready") return <div className="media-slot media-loading">{filename}</div>;
    return (
      <button
        type="button"
        className="media-slot media-image-button"
        disabled={opening}
        onClick={() => {
          setOpening(true);
          void loadFull()
            .then((full) => onOpenLightbox(full, filename))
            .catch(() => onOpenLightbox(load.url, filename))
            .finally(() => setOpening(false));
        }}
      >
        <img src={load.url} alt={filename} loading="lazy" />
      </button>
    );
  }

  if (load.status !== "ready") {
    return (
      <button
        type="button"
        className="media-slot media-file"
        disabled={load.status === "loading"}
        onClick={() => {
          setLoad({ status: "loading" });
          void loadFull().then(
            (url) => setLoad({ status: "ready", url }),
            () => setLoad({ status: "error" }),
          );
        }}
      >
        {load.status === "loading" ? `Loading ${filename}…` : load.status === "error" ? `Could not load ${filename}` : filename}
      </button>
    );
  }
  if (kind === "video") {
    return (
      <video className="media-slot" controls autoPlay>
        <source src={load.url} type={mime} />
      </video>
    );
  }
  if (kind === "audio") {
    return (
      <audio className="media-slot" controls autoPlay>
        <source src={load.url} type={mime} />
      </audio>
    );
  }
  return (
    <a className="media-slot media-file" href={load.url} download={filename}>
      {filename}
    </a>
  );
}
