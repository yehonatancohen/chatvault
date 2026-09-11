import { APP_STORE_URL } from "../../lib/site";

/** The one thing every page on this site leads to: the app. */
export function GetTheApp({ compact = false }: { compact?: boolean }) {
  const label = compact ? "Get Boydem" : "Save your own chats — get Boydem";
  if (APP_STORE_URL === "") {
    return <span className={compact ? "app-cta app-cta-compact soon" : "app-cta soon"}>Boydem · coming soon to iPhone</span>;
  }
  return (
    <a className={compact ? "app-cta app-cta-compact" : "app-cta"} href={APP_STORE_URL}>
      {label}
    </a>
  );
}
