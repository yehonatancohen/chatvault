import { ImageResponse } from "next/og";

/** The home-screen icon: the mark at the size iOS asks for, drawn from the same shapes as `icon.svg`. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<Mark size={180} />, size);
}

export function Mark({ size: edge }: { size: number }) {
  return (
    <div style={{ width: edge, height: edge, display: "flex", background: "#2436c9" }}>
      <svg width={edge} height={edge} viewBox="0 0 120 120">
        <path d="M60 16 L106 56 V64 H14 V56 Z" fill="#ffffff" />
        <path
          d="M44 37 H76 a6 6 0 0 1 6 6 V50 a6 6 0 0 1 -6 6 H55 L45 63.5 V56 H44 a6 6 0 0 1 -6 -6 V43 a6 6 0 0 1 6 -6 Z"
          fill="#ff5b24"
        />
        <rect x="14" y="72" width="92" height="10" fill="#ffffff" />
        <rect x="14" y="90" width="92" height="10" fill="#8e98e8" />
      </svg>
    </div>
  );
}
