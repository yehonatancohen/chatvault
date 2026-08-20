import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";

/**
 * Routes a share-sheet handoff to the import screen.
 *
 * The extension's only job is to drop the file in the App Group container and exit; by the
 * time this runs we are back in the host app with a full memory budget, and `shareIntent`
 * carries a *path*, never the file's contents.
 */
function ShareIntentRouter() {
  const { hasShareIntent, shareIntent } = useShareIntentContext();
  const router = useRouter();

  useEffect(() => {
    if (!hasShareIntent) return;
    const file = shareIntent.files?.[0];
    if (!file) return;

    router.replace({
      pathname: "/import",
      params: {
        path: file.path,
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: String(file.size ?? 0),
      },
    });
  }, [hasShareIntent, shareIntent, router]);

  return null;
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <StatusBar style="auto" />
      <ShareIntentRouter />
      <Stack screenOptions={{ headerShadowVisible: false }} />
    </ShareIntentProvider>
  );
}
