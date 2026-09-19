// `expo-router/js-tabs` rather than the `Tabs` re-exported from `expo-router`, which SDK 57
// deprecates. Same component, same props; the bare export logs a deprecation and is scheduled
// to go. The other option, `expo-router/unstable-native-tabs`, is what its name says.
import { Tabs } from "expo-router/js-tabs";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useApp } from "../../components/app/providers";
import { Icon } from "../../components/app/Icon";
import { space, type } from "../../lib/ui/theme";

/**
 * The bottom bar.
 *
 * Three destinations: the list you came for, who you are, and the settings. There is no `+`
 * tab — **this app has no way to reach into WhatsApp** (root CLAUDE.md, invariants 1 and 7), so
 * "adding a chat" is five lines of instruction, not a destination worth a whole tab. It lives as
 * a modal sheet (`app/add-chat.tsx`) instead, reachable from the small header button below, from
 * the empty library's tutorial, and from Help.
 *
 * `index` stays the first route so that `router.replace("/")` — which Import, Verify and the
 * reader all use to get home — still lands on the chat list.
 */
export const unstable_settings = {
  initialRouteName: "index",
};

/** The chat list's own header button — the way to add a second chat once the tutorial is past. */
function AddChatButton() {
  const router = useRouter();
  const { theme, t } = useApp();
  return (
    <Pressable
      onPress={() => router.push("/add-chat")}
      accessibilityRole="button"
      accessibilityLabel={t("add.title")}
      hitSlop={10}
      // `expo-router/js-tabs` renders its header flush to the screen edge, unlike the Stack
      // header (see `HomeButton`/`SheetDone` in `app/_layout.tsx`), which insets on its own.
      style={({ pressed }) => [{ marginEnd: space.sm }, pressed && { opacity: 0.5 }]}
    >
      <Icon name="add" color={theme.accent} size={28} background={theme.paper} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { theme, t } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: theme.ink,
        headerStyle: { backgroundColor: theme.paper },
        // A tab's header names the whole screen, so it is the app's `title` step — one above
        // the `heading` a stack header uses, and the only place that size appears in chrome.
        // Leading-aligned, the way iOS sets a top-level screen's title, not centred like a
        // pushed screen's.
        headerTitleAlign: "left",
        headerTitleStyle: { color: theme.ink, ...type.title },
        sceneStyle: { backgroundColor: theme.paper },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.panel,
          borderTopColor: theme.hairline,
          // The default is a hairline that disappears entirely against the dark palette's
          // panels; one point is the least that stays visible in both.
          borderTopWidth: 1,
          // Padding, not `height`: the bar measures its own safe-area inset, and giving it a
          // fixed height throws that away and tucks the labels under the home indicator.
          paddingTop: space.sm,
        },
        tabBarLabelStyle: { ...type.micro, fontSize: 11, lineHeight: 14, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.chats"),
          headerTitle: t("library.title"),
          headerRight: () => <AddChatButton />,
          tabBarIcon: ({ color }) => (
            <Icon name="chats" color={color} size={24} background={theme.paper} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t("tabs.account"),
          headerTitle: t("account.title"),
          tabBarIcon: ({ color }) => (
            <Icon name="account" color={color} size={24} background={theme.paper} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          headerTitle: t("settings.title"),
          tabBarIcon: ({ color }) => (
            <Icon name="settings" color={color} size={24} background={theme.paper} />
          ),
        }}
      />
    </Tabs>
  );
}
