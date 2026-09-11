// Must be the first import in the app: it sets the native layout direction from the saved
// language before any component renders. See `lib/i18n/bootstrap.ts` for why that cannot be
// done from inside a component.
import "../lib/i18n/bootstrap";

import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable } from "react-native";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { AppProvider, useApp } from "../components/app/providers";
import { TabIcon } from "../components/app/TabIcon";

/**
 * `(tabs)` is the anchor of the stack, not merely its first screen.
 *
 * A share-sheet handoff cold-starts the app straight onto `/import` (see `+native-intent.ts`),
 * so without this there is nothing underneath it and the user lands on a screen with no way
 * back — which is exactly how it behaved. Naming the anchor makes expo-router place the tab
 * bar beneath `/import` even when the app was launched directly into it, so Back always leads
 * somewhere.
 *
 * **This changed from `"index"` when the tabs went in**, and it has to stay in step with the
 * name of the group directory: an `initialRouteName` that names a route which no longer exists
 * is silently ignored, and the dead end comes straight back.
 */
export const unstable_settings = {
  initialRouteName: "(tabs)",
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

/**
 * The navigator, inside the provider so that headers restyle and retranslate with the setting.
 *
 * Screen titles come from `t()` rather than being literals in `screenOptions`, which is the
 * reason this is a component at all — `RootLayout` itself sits outside the provider and cannot
 * call the hook.
 */
/** Straight to the chat list from any depth: pops the whole stack, then shows the Chats tab. */
function HomeButton() {
  const router = useRouter();
  const { theme, t } = useApp();
  return (
    <Pressable
      onPress={() => router.dismissTo("/")}
      accessibilityRole="button"
      accessibilityLabel={t("tabs.chats")}
      hitSlop={10}
      style={({ pressed }) => pressed && { opacity: 0.5 }}
    >
      <TabIcon name="chats" color={theme.ink} background={theme.paper} />
    </Pressable>
  );
}

function Navigation() {
  const { theme, t } = useApp();

  return (
    <>
      {/*
        Tied to the palette rather than "auto": with an explicit Light or Dark override the
        phone's own appearance is the wrong thing to follow, and the status bar is the one part
        of the screen the app does not draw itself.
      */}
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: theme.ink,
          headerStyle: { backgroundColor: theme.paper },
          headerTitleStyle: { color: theme.ink },
          contentStyle: { backgroundColor: theme.paper },
          // Every screen below the tabs gets a way straight home — back, back, back is not a
          // way to get anywhere. The tabs draw their own headers and never show this one.
          headerRight: () => <HomeButton />,
        }}
      >
        {/* The tab bar draws its own headers, so the stack must not draw a second one above it. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ title: t("import.title") }} />
        {/*
          Verify is the trust moment and is reached with `replace` from Import, so there is
          deliberately no back-link to a screen that has already done its work. `gestureEnabled`
          off for the same reason: swiping back from here would land on a finished import.
        */}
        <Stack.Screen
          name="verify"
          options={{ title: t("verify.title"), gestureEnabled: false }}
        />
        <Stack.Screen name="delete-guide" options={{ title: t("deleteGuide.title") }} />
        <Stack.Screen name="help" options={{ title: t("help.title") }} />
        {/* Titles come from the archive's own manifest — see each screen's `Stack.Screen`. */}
        <Stack.Screen name="archive/[id]/index" options={{ title: t("reader.title") }} />
        <Stack.Screen name="archive/[id]/info" options={{ title: t("info.title") }} />
        <Stack.Screen name="archive/[id]/media" options={{ title: t("media.title") }} />
        {/* Dev-only; Settings only links to it under `__DEV__`. See `dev-storage.tsx`. */}
        <Stack.Screen name="dev-storage" options={{ title: t("dev.title") }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <AppProvider>
        <ShareIntentRouter />
        <Navigation />
      </AppProvider>
    </ShareIntentProvider>
  );
}
