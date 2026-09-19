/**
 * The app's icons: SF Symbols on iOS, drawn `View`s everywhere else.
 *
 * iOS users read SF Symbols as the system's own vocabulary, and they follow the text size and
 * mirror for Hebrew on their own (`chevron.forward` points left in a right-to-left layout).
 * `expo-symbols` was already compiled into the iOS build as a dependency of `expo-router`, so
 * listing it directly added no native code — see `apps/mobile/CLAUDE.md` on why that matters.
 *
 * Android keeps the drawn shapes from `TabIcon.tsx` as the fallback: `SymbolView` renders its
 * `fallback` wherever SF Symbols do not exist.
 */

import { SymbolView, type SFSymbol } from "expo-symbols";
import { StyleSheet, Text, View, type ColorValue } from "react-native";
import { TabIcon } from "./TabIcon";

export type IconName =
  | "chats"
  | "account"
  | "settings"
  | "add"
  | "home"
  | "chevron"
  | "check"
  | "help"
  | "lock";

const SYMBOLS: Record<IconName, SFSymbol> = {
  chats: "bubble.left.and.bubble.right.fill",
  account: "person.crop.circle.fill",
  settings: "gearshape.fill",
  add: "plus.circle.fill",
  home: "house.fill",
  chevron: "chevron.forward",
  check: "checkmark",
  help: "questionmark.circle.fill",
  lock: "lock.fill",
};

export function Icon({
  name,
  color,
  size = 24,
  weight = "semibold",
  background = "transparent",
}: {
  name: IconName;
  color: ColorValue;
  size?: number;
  weight?: "regular" | "medium" | "semibold" | "bold";
  /** The surface behind the icon, which the drawn Android settings icon needs. */
  background?: ColorValue;
}) {
  return (
    <SymbolView
      name={SYMBOLS[name]}
      tintColor={color}
      size={size}
      weight={weight}
      type="monochrome"
      style={{ width: size, height: size }}
      fallback={<Fallback name={name} color={color} size={size} background={background} />}
    />
  );
}

function Fallback({
  name,
  color,
  size,
  background,
}: {
  name: IconName;
  color: ColorValue;
  size: number;
  background: ColorValue;
}) {
  if (name === "chats" || name === "account" || name === "settings" || name === "add") {
    return <TabIcon name={name} color={color} background={background} />;
  }
  if (name === "home") {
    // A gable over a box.
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View style={[styles.roof, { borderBottomColor: color }]} />
        <View style={[styles.house, { backgroundColor: color }]} />
      </View>
    );
  }
  if (name === "chevron") {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View style={[styles.chevron, { borderColor: color }]} />
      </View>
    );
  }
  if (name === "check") {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View style={[styles.check, { borderColor: color }]} />
      </View>
    );
  }
  if (name === "lock") {
    // A shackle over a body.
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View style={[styles.shackle, { borderColor: color }]} />
        <View style={[styles.lockBody, { backgroundColor: color }]} />
      </View>
    );
  }
  // help: a filled disc with a question mark cut out of it.
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.disc, styles.box, { backgroundColor: color, width: size * 0.84, height: size * 0.84 }]}>
        <Text style={[styles.mark, { color: background === "transparent" ? "#ffffff" : background, fontSize: size * 0.6, lineHeight: size * 0.8 }]}>?</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  chevron: {
    width: 9,
    height: 9,
    borderTopWidth: 2,
    borderEndWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  check: {
    width: 14,
    height: 8,
    borderStartWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: "-45deg" }],
    marginTop: -4,
  },
  disc: { borderRadius: 999 },
  mark: { fontWeight: "800", textAlign: "center" },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  house: { width: 14, height: 9 },
  shackle: { width: 10, height: 8, borderWidth: 2.5, borderBottomWidth: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  lockBody: { width: 16, height: 11, borderRadius: 2 },
});
