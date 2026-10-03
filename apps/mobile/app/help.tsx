import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "../components/app/Icon";
import { createStyles, useApp } from "../components/app/providers";
import { LinkRow, Screen, Section } from "../components/app/ui";
import type { StringKey } from "../lib/i18n/strings";
import { space, TAP, type } from "../lib/ui/theme";

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
  const router = useRouter();
  const styles = useStyles();
  const [open, setOpen] = useState<string | undefined>(undefined);

  return (
    <Screen>
      <Section>
        <LinkRow label={t("add.title")} onPress={() => router.push("/add-chat")} />
      </Section>

      <Section>
        {TOPICS.map((topic) => {
          const expanded = open === topic;
          return (
            <View key={topic}>
              <Pressable
                onPress={() => setOpen(expanded ? undefined : topic)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={({ pressed }) => [styles.header, pressed && styles.pressed]}
              >
                <Text style={styles.title}>{t(`help.${topic}.title` as StringKey)}</Text>
                {/* The system's disclosure mark: down for "there is more here", up once open. */}
                <Icon
                  name={expanded ? "collapse" : "expand"}
                  color={styles.chevron.color}
                  size={14}
                  weight="semibold"
                />
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
      </Section>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  // Bled to the group's edges, like every tappable row in a `Section` (`components/app/ui.tsx`).
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: TAP,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginHorizontal: -space.lg,
    gap: space.md,
  },
  pressed: { backgroundColor: t.highlight },
  title: { flex: 1, ...type.label, color: t.ink, textAlign: "left", writingDirection: "auto" },
  chevron: { color: t.faint },
  bodyBlock: { gap: space.md, paddingBottom: space.lg },
  body: { ...type.caption, color: t.body, textAlign: "left", writingDirection: "auto" },
}));
