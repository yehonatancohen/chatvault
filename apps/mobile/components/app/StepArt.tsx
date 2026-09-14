/**
 * Small drawn icons for the five "add a chat" steps, shared by the add-chat sheet
 * (`app/add-chat.tsx`) and the tutorial's second slide (`Onboarding.tsx`).
 *
 * Built from `View`s in the same convention as `TabIcon.tsx` — no icon library, for the reason
 * that file explains: this workspace's unpinned peer deps have silently broken the app at launch
 * before, and four or five more shapes are not worth reopening that.
 */

import { StyleSheet, View, type ColorValue } from "react-native";

const SIZE = 32;

export type StepArtName = "open" | "name" | "export" | "media" | "pick";

export function StepArt({ name, color }: { name: StepArtName; color: ColorValue }) {
  return (
    <View style={styles.frame}>
      {name === "open" && <OpenIcon color={color} />}
      {name === "name" && <NameIcon color={color} />}
      {name === "export" && <ExportIcon color={color} />}
      {name === "media" && <MediaIcon color={color} />}
      {name === "pick" && <PickIcon color={color} />}
    </View>
  );
}

/** A chat bubble, opened — the same silhouette as `TabIcon`'s chats icon, at this icon's scale. */
function OpenIcon({ color }: { color: ColorValue }) {
  return (
    <View
      style={{
        width: 22,
        height: 18,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 6,
        borderBottomLeftRadius: 1,
      }}
    />
  );
}

/** A name bar with a tap ring above it. */
function NameIcon({ color }: { color: ColorValue }) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View
        style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: color }}
      />
      <View style={{ width: 20, height: 3, borderRadius: 1.5, backgroundColor: color }} />
    </View>
  );
}

/** An arrow lifting out of a tray — "export". */
function ExportIcon({ color }: { color: ColorValue }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 2,
          height: 12,
          backgroundColor: color,
          transform: [{ rotate: "180deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          width: 0,
          height: 0,
          borderLeftWidth: 5,
          borderRightWidth: 5,
          borderBottomWidth: 6,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          marginTop: 4,
          width: 22,
          height: 8,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 3,
        }}
      />
    </View>
  );
}

/** A paperclip — "attach media". */
function MediaIcon({ color }: { color: ColorValue }) {
  return (
    <View
      style={{
        width: 12,
        height: 20,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 6,
        borderBottomWidth: 2,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 4,
          left: 2,
          width: 4,
          height: 9,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

/** A checkmark inside a rounded square — "pick this app" from the share sheet. */
function PickIcon({ color }: { color: ColorValue }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 10,
          height: 6,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          transform: [{ rotate: "-45deg" }],
          marginTop: -2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
});
