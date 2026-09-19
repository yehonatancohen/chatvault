import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Assistant, Secular_One } from "next/font/google";
import "./globals.css";

/**
 * Two faces, both self-hosted: `next/font` downloads them at build time and serves them from this
 * site, so a visitor's browser never makes a request to Google for them.
 *
 * - **Secular One** is the sign voice — headlines, prices, the numbers. One heavy weight, which
 *   is the point: a sign has no light cut. The app ships the same face (`apps/mobile/assets/fonts`).
 * - **Assistant** is for reading. Plain and open, as clear in Hebrew as in Latin.
 */
const secularOne = Secular_One({
  subsets: ["hebrew", "latin"],
  weight: "400",
  display: "swap",
  variable: "--font-sign",
});
const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-read",
});

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

export const viewport = {
  themeColor: "#2436c9",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${secularOne.variable} ${assistant.variable}`}>
      <body>{children}</body>
    </html>
  );
}
