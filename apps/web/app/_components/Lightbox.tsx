"use client";

import { useEffect, useRef } from "react";

interface LightboxProps {
  readonly url: string;
  readonly filename: string;
  readonly onClose: () => void;
}

/**
 * A photo, full screen. Closes on Escape, on the backdrop and on its button, and hands focus
 * back to whatever opened it — a reader on a keyboard must not be left behind a photo.
 */
export function Lightbox({ url, filename, onClose }: LightboxProps) {
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div className="lightbox-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={filename}>
      <img className="lightbox-image" src={url} alt={filename} onClick={(e) => e.stopPropagation()} />
      <button ref={close} type="button" className="lightbox-close" onClick={onClose} aria-label="סגירה">
        ✕
      </button>
    </div>
  );
}
