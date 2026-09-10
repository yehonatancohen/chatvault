import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "בוידעם — Boydem",
  description: "A WhatsApp chat archive you own and can actually read.",
  // Archive pages carry a decryption key in the URL fragment. Referrers never include the
  // fragment, but sending no referrer at all removes any doubt about leaking archive ids.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
