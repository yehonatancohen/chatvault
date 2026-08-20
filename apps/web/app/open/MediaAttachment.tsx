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

type Load = { readonly status: "idle" } | { readonly status: "loading" } | { readonly status: "ready"; readonly url: string } | { readonly status: "error" };

/**
 * Decrypts on demand, not up front — an archive can hold thousands of blobs, and the whole
 * point of the manifest's `firstTs`/`lastTs` chunking is to avoid paying for what is not on
 * screen. Object URLs are revoked on unmount so a long scroll session does not leak memory.
 */
export function MediaAttachment({ reader, filename, sha256, onOpenLightbox }: MediaAttachmentProps) {
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const mime = mimeFromFilename(filename);
  const kind = mediaClassOf(mime);

  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;

    setLoad({ status: "loading" });
    reader
      .readMedia(sha256)
      .then((bytes) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
        setLoad({ status: "ready", url });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "error" });
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sha256]);

  if (load.status === "idle" || load.status === "loading") {
    return <div className="media-slot media-loading">{filename}</div>;
  }
  if (load.status === "error") {
    return <div className="media-slot media-error">Could not decrypt {filename}</div>;
  }

  if (kind === "image") {
    return (
      <button
        type="button"
        className="media-slot media-image-button"
        onClick={() => onOpenLightbox(load.url, filename)}
      >
        <img src={load.url} alt={filename} loading="lazy" />
      </button>
    );
  }
  if (kind === "video") {
    return (
      <video className="media-slot" controls preload="none">
        <source src={load.url} type={mime} />
      </video>
    );
  }
  if (kind === "audio") {
    return (
      <audio className="media-slot" controls preload="none">
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
