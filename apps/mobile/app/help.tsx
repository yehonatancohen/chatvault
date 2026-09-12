import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createStyles, useApp } from "../components/app/providers";
import { Screen } from "../components/app/ui";
import type { StringKey } from "../lib/i18n/strings";
import { radius, space, TAP, type } from "../lib/ui/theme";

/**
 * Help — every explanation the app has, in one place, so the working screens can stay short.
 *
 * Topics collapse to their titles; tap one to read it. The body strings use blank lines between
 * paragraphs. Anything a screen used to explain inline belongs here now — and anything here
 * must stay true: nothing may claim the app deletes from WhatsApp (invariant 1) or that chats go
 * to our servers (invariant 2).
 *
 * **One card, eight rows** rather than eight cards. Eight separate panels down a page reads as
 * eight unrelated documents; a single divided list reads as one contents page, which is what
 * this is. The open topic keeps its body inside the same row, so the divider still marks where
 * the next topic begins.
 */

const TOPICS = ["how", "privacy", "media", "drive", "delete", "merge", "limits", "about"] as const;

export default function HelpScreen() {
  const { t } = useApp();
  const styles = useStyles();
  const [open, setOpen] = useState<string | undefined>(undefined);

  return (
    <Screen gap={0}>
      <View style={styles.card}>
        {TOPICS.map((topic, index) => {
          const expanded = open === topic;
          return (
            <View key={topic}>
              {index > 0 && <View style={styles.separator} />}
              <Pressable
                onPress={() => setOpen(expanded ? undefined : topic)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={({ pressed }) => [styles.header, pressed && styles.pressed]}
              >
                <Text style={styles.title}>{t(`help.${topic}.title` as StringKey)}</Text>
                {/* A rotated chevron rather than +/−: the same mark the rest of the app uses
                    for "there is more this way", turned to point down when it is open. */}
                <View style={[styles.chevron, expanded && styles.chevronOpen]} />
              </Pressable>
              {expanded && (
                <View style={styles.bodyBlock}>
                  {t(`help.${topic}.body` as StringKey)
                    .split("\n\n")
                    .map((paragraph) => (
                      <Text key={paragraph.slice(0, 24)} style={styles.body}>
                        {paragraph}
                      </Text>
                    ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  card: {
    backgroundColor: t.panel,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
    paddingHorizontal: space.lg,
    overflow: "hidden",
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.separator },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: TAP + 4,
    paddingVertical: space.md,
    gap: space.md,
  },
  pressed: { backgroundColor: t.accentWash },
  title: { flex: 1, ...type.label, color: t.ink, writingDirection: "auto" },
  chevron: {
    width: 8,
    height: 8,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: t.faint,
    transform: [{ rotate: "45deg" }],
  },
  chevronOpen: { borderColor: t.accent, transform: [{ rotate: "135deg" }], marginBottom: 4 },
  bodyBlock: { gap: space.md, paddingBottom: space.lg },
  body: { ...type.caption, color: t.body, writingDirection: "auto" },
}));
