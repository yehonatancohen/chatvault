import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";

/**
 * `index` is the anchor of the stack, not merely its first screen.
 *
 * A share-sheet handoff cold-starts the app straight onto `/import` (see `+native-intent.ts`),
 * so without this there is nothing underneath it and the user lands on a screen with no way
 * back — which is exactly how it behaved. Naming the anchor makes expo-router place the
 * library beneath `/import` even when the app was launched directly into it, so Back always
 * leads somewhere.
 */
export const unstable_settings = {
  initialRouteName: "index",
};

/**
 * Routes a share-sheet handoff to the import screen.
 *
 * The extension's only job is to drop the file in the App Group container and exit; by the
 * time this runs we are back in the host app with a full memory budget, and `shareIntent`
 * carries a *path*, never the file's contents.
 *
 * `+native-intent.ts` has already sent us to `/import`, but it only ever sees the deep-link
 * URL and so cannot supply the file. This replaces that bare screen with one carrying the
 * file's path and metadata — `replace` rather than `push` so the two do not stack up as two
 * Import screens in a row.
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
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerBackTitle: "Library",
          headerTintColor: "#1c1b19",
          headerStyle: { backgroundColor: "#faf9f6" },
          contentStyle: { backgroundColor: "#faf9f6" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "ChatVault" }} />
        <Stack.Screen name="import" options={{ title: "Import" }} />
        {/*
          Verify is the trust moment and is reached with `replace` from Import, so there is
          deliberately no back-link to a screen that has already done its work. `gestureEnabled`
          off for the same reason: swiping back from here would land on a finished import.
        */}
        <Stack.Screen name="verify" options={{ title: "What was captured", gestureEnabled: false }} />
        <Stack.Screen name="delete-guide" options={{ title: "Delete in WhatsApp" }} />
        {/* Titles come from the archive's own manifest — see each screen's `Stack.Screen`. */}
        <Stack.Screen name="archive/[id]/index" options={{ title: "Archive" }} />
        <Stack.Screen name="archive/[id]/info" options={{ title: "Chat info" }} />
        <Stack.Screen name="archive/[id]/media" options={{ title: "Media" }} />
        {/* Dev-only; `index.tsx` only links to it under `__DEV__`. See `dev-storage.tsx`. */}
        <Stack.Screen name="dev-storage" options={{ title: "Storage contract" }} />
      </Stack>
    </ShareIntentProvider>
  );
}
