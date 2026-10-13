/**
 * The tab bar, as iOS 26 draws one: a capsule of Liquid Glass floating above the content, with
 * the selected destination on a filled pill inside it.
 *
 * **Drawn here rather than by `expo-router/unstable-native-tabs`**, which would give the system's
 * own bar: that navigator changes how the tab routes are mounted, and a share-sheet hand-off
 * cold-starts the app onto a route beneath them (`apps/mobile/CLAUDE.md`, "The extension reopens
 * the app with a signal URL"). This keeps the navigator the app has always had — same routes,
 * same headers — and replaces only what is drawn at the bottom.
 *
 * The bar is **absolutely positioned**, so a screen's content runs underneath it and the glass has
 * something to refract. Every tab screen therefore ends its scroll content with
 * `useTabBarSpace()` of padding (`Screen` does this for any screen with a `largeTitle`).
 *
 * The selected pill is a plain fill, not a second sheet of glass: glass on glass is the one
 * thing the material's guidance rules out (`Glass.tsx`).
 */

import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "./Glass";
import { createStyles, useTheme } from "./providers";
import { space } from "../../lib/ui/theme";

/** The capsule's own height. */
const BAR_HEIGHT = 64;
/** The gap under the capsule on a phone with no home indicator. */
const FLOOR = space.md;

/** How far above the screen's bottom edge the capsule floats. */
function bottomOffset(inset: number): number {
  // The home indicator's inset is mostly empty space around a thin bar; sitting the capsule
  // fully above it leaves a gap twice the size of the one beside it.
  return Math.max(inset - space.sm, FLOOR);
}

/** The space a tab screen leaves at the end of its content so nothing hides under the bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + bottomOffset(insets.bottom) + space.lg;
}

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.dock, { paddingBottom: bottomOffset(insets.bottom) }]} pointerEvents="box-none">
      <Glass style={styles.bar} fallbackStyle={styles.barFallback} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options;
          const focused = state.index === index;
          const label = options?.title ?? route.name;
          const color = focused ? theme.accent : theme.muted;

          const onPress = (): void => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [styles.item, focused && styles.itemFocused, pressed && !focused && styles.itemPressed]}
            >
              {options?.tabBarIcon?.({ focused, color, size: 24 })}
              <Text style={[styles.label, { color }]} numberOfLines={1} allowFontScaling={false}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: space.xl,
  },
  bar: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 420,
    height: BAR_HEIGHT,
    padding: space.xs,
    gap: space.xs,
    borderRadius: BAR_HEIGHT / 2,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  // No glass: the bar is the system's opaque bar material, lifted off the page by a hairline
  // and a soft shadow so it still reads as floating.
  barFallback: {
    backgroundColor: t.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
    overflow: "visible",
    shadowColor: "#000000",
    shadowOpacity: t.dark ? 0.5 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: (BAR_HEIGHT - space.xs * 2) / 2,
    borderCurve: "continuous",
  },
  itemFocused: { backgroundColor: t.fill },
  itemPressed: { backgroundColor: t.fillFaint },
  // 10pt semibold is the system tab bar's own label, and the one text in the app below the
  // `micro` floor — it is chrome, sized by the platform rather than by this scale.
  label: { fontSize: 10, lineHeight: 12, fontWeight: "600" },
}));
