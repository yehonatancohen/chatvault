"use client";

interface LightboxProps {
  readonly url: string;
  readonly filename: string;
  readonly onClose: () => void;
}

export function Lightbox({ url, filename, onClose }: LightboxProps) {
  return (
    <div className="lightbox-backdrop" onClick={onClose} role="presentation">
      <img className="lightbox-image" src={url} alt={filename} onClick={(e) => e.stopPropagation()} />
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="סגירה">
        ✕
      </button>
    </div>
  );
}
