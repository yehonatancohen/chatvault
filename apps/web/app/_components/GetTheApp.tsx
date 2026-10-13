import { APP_STORE_URL } from "../../lib/site";

/** The one thing every page on this site leads to: the app. */
export function GetTheApp({ compact = false }: { compact?: boolean }) {
  const label = compact ? "להורדת בוידעם" : "לשמור גם את הצ׳אטים שלכם — בוידעם";
  if (APP_STORE_URL === "") {
    // Compact sits in the viewer's header and in its strip, both of which already say whose app
    // this is; the full label there cost a chat's name most of its width on a phone.
    return compact ? (
      <span className="app-cta app-cta-compact soon">בקרוב לאייפון</span>
    ) : (
      <span className="app-cta soon">בוידעם · בקרוב לאייפון</span>
    );
  }
  return (
    <a className={compact ? "app-cta app-cta-compact" : "app-cta"} href={APP_STORE_URL}>
      {label}
    </a>
  );
}
