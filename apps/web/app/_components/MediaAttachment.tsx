"use client";

import { useEffect, useRef, useState } from "react";
import { displayFilename, type ArchiveReader, type MediaType } from "@chatvault/core";
import { mediaClassOf, mimeFromFilename } from "../../lib/mime";

interface MediaAttachmentProps {
  readonly reader: ArchiveReader;
  readonly filename: string;
  readonly sha256: string;
  /** What WhatsApp called it — the only thing that tells a sticker from a photo, a GIF from a video. */
  readonly media?: MediaType;
  /** A document's or contact's own name, and what WhatsApp printed beside it ("2 pages"). */
  readonly title?: string | undefined;
  readonly detail?: string | undefined;
  /** `owned` is true when the URL was made for the lightbox, which then releases it on close. */
  readonly onOpenLightbox: (url: string, filename: string, owned: boolean) => void;
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
 * Object URLs are revoked on unmount so a long scroll session does not leak memory — the
 * preview's by its own effect, a tapped video's or file's by `held`, and a full photo's by the
 * lightbox that asked for it.
 */
export function MediaAttachment({ reader, filename, sha256, media, title, detail, onOpenLightbox }: MediaAttachmentProps) {
  const mime = mimeFromFilename(filename);
  const kind = mediaClassOf(mime);
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [opening, setOpening] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** The URL a tap made (video, voice note, file), released when this row scrolls away. */
  const held = useRef<string | undefined>(undefined);

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
  }, [sha256, attempt]);

  useEffect(
    () => () => {
      if (held.current !== undefined) URL.revokeObjectURL(held.current);
    },
    [],
  );

  async function loadFull(): Promise<string> {
    const bytes = await reader.readMedia(sha256);
    return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
  }

  if (kind === "image") {
    if (load.status === "error") {
      return (
        <button type="button" className="media-slot media-error media-retry" onClick={() => setAttempt((n) => n + 1)}>
          התמונה לא נטענה. לנסות שוב
        </button>
      );
    }
    if (load.status !== "ready") return <div className="media-slot media-skeleton" role="img" aria-label="תמונה נטענת" />;
    return (
      <button
        type="button"
        className={media === "sticker" ? "media-slot media-image-button media-sticker" : "media-slot media-image-button"}
        disabled={opening}
        aria-label="פתיחת התמונה"
        onClick={() => {
          setOpening(true);
          void loadFull()
            .then((full) => onOpenLightbox(full, filename, true))
            // The preview is still a photo: better shown small than not at all.
            .catch(() => onOpenLightbox(load.url, filename, false))
            .finally(() => setOpening(false));
        }}
      >
        <img src={load.url} alt="" />
      </button>
    );
  }

  if (load.status !== "ready") {
    const label =
      media === "contact" ? "איש קשר"
      : media === "gif" ? "GIF"
      : kind === "video" ? "סרטון"
      : kind === "audio" ? "הקלטה"
      : media === "document" ? "מסמך"
      : "קובץ";
    // The name its sender gave it, not the counter iOS put in front for the export.
    const name = title ?? displayFilename(filename);
    return (
      <button
        type="button"
        className="media-slot media-file"
        disabled={load.status === "loading"}
        onClick={() => {
          setLoad({ status: "loading" });
          void loadFull().then(
            (url) => {
              held.current = url;
              setLoad({ status: "ready", url });
              // A file has nothing to show in place, so the tap that fetched it also saves it —
              // it used to take a second tap on what looked like the same button.
              if (kind === "other") saveAs(url, filename);
            },
            () => setLoad({ status: "error" }),
          );
        }}
      >
        <bdi>
          {load.status === "loading"
            ? `טוענים את ${name}…`
            : load.status === "error"
              ? `${name} לא נטען. לנסות שוב`
              : `${label} · ${name}`}
        </bdi>
        {detail !== undefined && load.status === "idle" && <span className="media-file-detail">{detail}</span>}
      </button>
    );
  }
  if (media === "gif") {
    // A GIF is a short silent video in an export; WhatsApp plays it in place, on a loop.
    return (
      <video className="media-slot" autoPlay loop muted playsInline>
        <source src={load.url} type={mime} />
      </video>
    );
  }
  if (kind === "video") {
    return (
      <video className="media-slot" controls autoPlay playsInline>
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
      <bdi>{title ?? displayFilename(filename)}</bdi>
    </a>
  );
}

function saveAs(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}
