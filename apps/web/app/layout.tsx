import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Heebo } from "next/font/google";
import "./globals.css";

/**
 * Heebo, self-hosted: `next/font` downloads it at build time and serves it from this site, so a
 * visitor's browser never makes a request to Google for it.
 */
const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: "בוידעם — הצ׳אטים של וואטסאפ, שמורים אצלכם",
  description: "שומרים צ׳אטים של וואטסאפ עם כל התמונות ב־Google Drive שלכם, ומפנים מקום בטלפון.",
  // Shared-chat pages carry a key in the URL fragment. Referrers never include the fragment, but
  // sending no referrer at all removes any doubt about leaking which chat was opened.
  referrer: "no-referrer",
  openGraph: {
    title: "בוידעם",
    description: "הצ׳אטים של וואטסאפ, שמורים אצלכם — והטלפון מתפנה.",
    locale: "he_IL",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body>{children}</body>
    </html>
  );
}
