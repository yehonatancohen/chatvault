// `expo-router/js-tabs` rather than the `Tabs` re-exported from `expo-router`, which SDK 57
// deprecates. Same component, same props; the bare export logs a deprecation and is scheduled
// to go. The other option, `expo-router/unstable-native-tabs`, is what its name says.
import { Tabs } from "expo-router/js-tabs";
import { useApp } from "../../components/app/providers";
import { TabIcon } from "../../components/app/TabIcon";
import { space, type } from "../../lib/ui/theme";

/**
 * The bottom bar.
 *
 * Four destinations, and the shape is the one every phone user already knows: the list you
 * came for, the thing you can add, who you are, and the settings. What is unusual is the
 * middle one — in Instagram or TikTok the `+` opens a camera, and here it cannot open anything,
 * because **this app has no way to reach into WhatsApp** (root CLAUDE.md, invariants 1 and 7).
 * A chat arrives through the share sheet or not at all. So Add is a screen that teaches the
 * export, which is the actual thing standing between a new user and their first archive, and it
 * is a tab rather than a link buried in an empty state because a user with one archive still
 * needs to find it to make a second.
 *
 * `index` stays the first route so that `router.replace("/")` — which Import, Verify and the
 * reader all use to get home — still lands on the chat list.
 */
export const unstable_settings = {
  initialRouteName: "index",
};

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
        headerTitleStyle: { color: theme.ink, ...type.title },
        sceneStyle: { backgroundColor: theme.paper },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: {
          backgroundColor: theme.paper,
          borderTopColor: theme.hairline,
          // The default is a hairline that disappears entirely against the dark palette's
          // panels; one point is the least that stays visible in both.
          borderTopWidth: 1,
          // Padding, not `height`: the bar measures its own safe-area inset, and giving it a
          // fixed height throws that away and tucks the labels under the home indicator.
          paddingTop: space.sm,
        },
        tabBarLabelStyle: { ...type.micro, letterSpacing: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.chats"),
          headerTitle: t("library.title"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="chats" color={color} background={theme.paper} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t("tabs.add"),
          headerTitle: t("add.title"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="add" color={color} background={theme.paper} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t("tabs.account"),
          headerTitle: t("account.title"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="account" color={color} background={theme.paper} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          headerTitle: t("settings.title"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="settings" color={color} background={theme.paper} />
          ),
        }}
      />
    </Tabs>
  );
}
