"use client";

import { useEffect, useState } from "react";
import { GetTheApp } from "./GetTheApp";

const DISMISSED_KEY = "boydem.banner.dismissed";

/**
 * The one nudge a shared chat carries: whoever is reading this arrived because someone else
 * archived a chat, which makes them the likeliest person in the world to want the app (see
 * `ACCOUNTS-AND-CLOUD.md` — a signed-out viewer on the website is the main way new users
 * arrive).
 *
 * So it sits at the bottom, above the conversation rather than in front of it, and it closes —
 * for good, in this browser. A nudge that cannot be dismissed is an advert; one that can is an
 * offer. `localStorage` is the right home for that: it is a per-visitor convenience, it is
 * nobody's data, and a browser that refuses it simply shows the banner again.
 */
export function AppBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false); // private windows and blocked storage: show it, remember nothing
    }
  }, []);

  if (dismissed) return null;

  return (
    <div className="app-banner" role="complementary">
      <div className="app-banner-text">
        <strong>לשמור ככה גם את הצ׳אטים שלכם?</strong>
        <span>בוידעם שומר אותם ב-Google Drive שלכם, ומדריך אתכם למחוק בוואטסאפ.</span>
      </div>
      <GetTheApp compact />
      <button
        type="button"
        className="app-banner-close"
        aria-label="סגירה"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(DISMISSED_KEY, "1");
          } catch {
            // Nothing to do: it closes for this visit, and comes back next time.
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}
