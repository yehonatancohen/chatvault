import type { Metadata } from "next";
import type { ReactNode } from "react";

/** A shared chat is someone's private conversation: never indexed, never followed. */
export const metadata: Metadata = {
  title: "צ׳אט ששותף איתכם — בוידעם",
  robots: { index: false, follow: false },
};

export default function SharedLayout({ children }: { children: ReactNode }) {
  return children;
}
