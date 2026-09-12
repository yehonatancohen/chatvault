import type { Metadata } from "next";
import type { ReactNode } from "react";

/** A popup in the middle of an OAuth flow: nothing here is a page anyone should land on. */
export const metadata: Metadata = {
  title: "חיבור ל-Google Drive — בוידעם",
  robots: { index: false, follow: false },
};

export default function ConnectLayout({ children }: { children: ReactNode }) {
  return children;
}
