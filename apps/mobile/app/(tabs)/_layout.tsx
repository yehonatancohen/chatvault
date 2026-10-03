// `expo-router/js-tabs` rather than the `Tabs` re-exported from `expo-router`, which SDK 57
// deprecates. Same component, same props; the bare export logs a deprecation and is scheduled
// to go. The other option, `expo-router/unstable-native-tabs`, is what its name says.
import { Tabs } from "expo-router/js-tabs";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
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
      style={({ pressed }) => [{ marginEnd: space.lg }, pressed && { opacity: 0.5 }]}
    >
      <Icon name="add" color={theme.accent} size={24} weight="medium" background={theme.paper} />
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
        // A top-level screen's name is a large title in its own content (`Screen largeTitle`,
        // `useLargeTitle`): the header starts empty and takes the name, centred and at Headline
        // like any inline navigation title, once the large one has scrolled away.
        headerTitle: "",
        headerTitleAlign: "center",
        headerTitleStyle: { color: theme.ink, ...type.heading },
        sceneStyle: { backgroundColor: theme.paper },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: {
          backgroundColor: theme.panel,
          borderTopColor: theme.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          // Padding, not `height`: the bar measures its own safe-area inset, and giving it a
          // fixed height throws that away and tucks the labels under the home indicator.
          paddingTop: space.xs,
        },
        // 10pt medium is the system tab bar's own label, and the one text in the app below the
        // `micro` floor — it is chrome, sized by the platform rather than by this scale.
        tabBarLabelStyle: { fontSize: 10, lineHeight: 12, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.chats"),
          // The chat list is a plain list, not a grouped form — see `(tabs)/index.tsx`.
          headerStyle: { backgroundColor: theme.base },
          sceneStyle: { backgroundColor: theme.base },
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
          tabBarIcon: ({ color }) => (
            <Icon name="account" color={color} size={24} background={theme.paper} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color }) => (
            <Icon name="settings" color={color} size={24} background={theme.paper} />
          ),
        }}
      />
    </Tabs>
  );
}
