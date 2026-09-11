/**
 * The four tab-bar icons, drawn from `View`s.
 *
 * **Deliberately not `@expo/vector-icons`.** `apps/mobile/CLAUDE.md` is explicit that a green
 * `pnpm install` proves nothing in this workspace: `autoInstallPeers` plus unpinned peers is
 * how `@expo/metro-runtime` silently resolved to a version that killed the app at launch with
 * no stack. Four shapes are not worth reopening that, so they are built from bordered boxes and
 * circles, which is all any of them actually is.
 *
 * Each icon is drawn inside a fixed square so the row cannot shift as the active tab changes
 * weight, and every stroke colour comes from the caller rather than the palette — the tab bar
 * is the one place where "active" and "inactive" are the whole meaning of the colour.
 */

import { StyleSheet, View, type ColorValue } from "react-native";

export type TabIconName = "chats" | "add" | "account" | "settings";

const SIZE = 24;

export function TabIcon({
  name,
  color,
  background,
}: {
  name: TabIconName;
  // `ColorValue`, not `string`: react-navigation hands the icon a platform colour, which on iOS
  // can be an opaque native reference rather than a hex string. Narrowing it here would force
  // every call site to cast.
  color: ColorValue;
  /** The surface behind the icon. Only the sliders need it — see `Slider`. */
  background: ColorValue;
}) {
  return (
    <View style={styles.frame} accessible={false}>
      {name === "chats" && <ChatsIcon color={color} />}
      {name === "add" && <AddIcon color={color} />}
      {name === "account" && <AccountIcon color={color} />}
      {name === "settings" && <SettingsIcon color={color} background={background} />}
    </View>
  );
}

/** A speech bubble: a rounded box with one squared-off bottom corner for the tail. */
function ChatsIcon({ color }: { color: ColorValue }) {
  return (
    <View
      style={{
        width: 20,
        height: 17,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 6,
        borderBottomLeftRadius: 1,
      }}
    />
  );
}

/** A plus inside a rounded square — the "new" affordance every chat app puts here. */
function AddIcon({ color }: { color: ColorValue }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 7,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ position: "absolute", width: 10, height: 2, backgroundColor: color }} />
      <View style={{ position: "absolute", width: 2, height: 10, backgroundColor: color }} />
    </View>
  );
}

/** Head and shoulders. The shoulders are a wide box clipped to its top half by the frame. */
function AccountIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.stack}>
      <View
        style={{ width: 9, height: 9, borderRadius: 4.5, borderWidth: 2, borderColor: color }}
      />
      <View
        style={{
          marginTop: 2,
          width: 18,
          height: 11,
          borderWidth: 2,
          borderColor: color,
          borderTopLeftRadius: 9,
          borderTopRightRadius: 9,
          borderBottomWidth: 0,
        }}
      />
    </View>
  );
}

/**
 * Two sliders, not a cog.
 *
 * A cog needs eight teeth to read as one and would be a pile of rotated views; sliders say
 * "settings" just as clearly with four rectangles, and match what this screen actually holds —
 * a short list of choices rather than machinery.
 */
function SettingsIcon({ color, background }: { color: ColorValue; background: ColorValue }) {
  return (
    <View style={styles.sliders}>
      <Slider color={color} background={background} knobOffset={11} />
      <Slider color={color} background={background} knobOffset={4} />
    </View>
  );
}

function Slider({
  color,
  background,
  knobOffset,
}: {
  color: ColorValue;
  background: ColorValue;
  knobOffset: number;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: color }} />
      <View
        style={{
          position: "absolute",
          left: knobOffset,
          width: 7,
          height: 7,
          borderRadius: 3.5,
          borderWidth: 2,
          borderColor: color,
          // Filled with the surface behind it: an unfilled knob lets the track show straight
          // through, and the two shapes then read as one line rather than a control.
          backgroundColor: background,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  stack: { alignItems: "center", justifyContent: "center", overflow: "hidden", height: SIZE },
  sliders: { gap: 6, alignItems: "center" },
  sliderRow: { width: 20, alignItems: "center", justifyContent: "center" },
});
