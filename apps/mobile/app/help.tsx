import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { createStyles, useApp } from "../components/app/providers";
import type { StringKey } from "../lib/i18n/strings";
import { radius, space } from "../lib/ui/theme";

/**
 * Help — every explanation the app has, in one place, so the working screens can stay short.
 *
 * Topics collapse to their titles; tap one to read it. The body strings use blank lines between
 * paragraphs. Anything a screen used to explain inline belongs here now — and anything here
 * must stay true: nothing may claim the app deletes from WhatsApp (invariant 1) or that chats go
 * to our servers (invariant 2).
 */

const TOPICS = ["how", "privacy", "media", "drive", "delete", "merge", "limits", "about"] as const;

export default function HelpScreen() {
  const { t } = useApp();
  const styles = useStyles();
  const [open, setOpen] = useState<string | undefined>(undefined);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {TOPICS.map((topic) => {
        const expanded = open === topic;
        return (
          <View key={topic} style={styles.topic}>
            <Pressable
              onPress={() => setOpen(expanded ? undefined : topic)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={({ pressed }) => [styles.header, pressed && styles.pressed]}
            >
              <Text style={styles.title}>{t(`help.${topic}.title` as StringKey)}</Text>
              <Text style={styles.chevron}>{expanded ? "−" : "+"}</Text>
            </Pressable>
            {expanded &&
              t(`help.${topic}.body` as StringKey)
                .split("\n\n")
                .map((paragraph) => (
                  <Text key={paragraph.slice(0, 24)} style={styles.body}>
                    {paragraph}
                  </Text>
                ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.lg, paddingBottom: space.xxl, gap: space.sm },
  topic: { borderRadius: radius.card, backgroundColor: t.panel, paddingHorizontal: space.lg, paddingBottom: space.xs },
  header: { flexDirection: "row", alignItems: "center", paddingVertical: space.md, gap: space.md },
  pressed: { opacity: 0.65 },
  title: { flex: 1, fontSize: 16, fontWeight: "600", color: t.ink, writingDirection: "auto" },
  chevron: { fontSize: 20, color: t.muted },
  body: { fontSize: 14.5, lineHeight: 22, color: t.body, paddingBottom: space.sm, writingDirection: "auto" },
}));
