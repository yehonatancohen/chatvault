import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { MediaExplanation } from "../../lib/ui/media-explanation";
import { updateSettings } from "../../lib/settings/settings";
import { space } from "../../lib/ui/theme";
import { createStyles, useApp } from "../app/providers";

/**
 * One quiet sentence about media the chat didn't include — and the way to read more, or never
 * see it again.
 *
 * Media missing from an export is normal: WhatsApp leaves out files that are no longer on the
 * phone, and an export made without media has none at all. So this is a neutral note, not a
 * warning. The full, computed explanation (`explainMedia`) is one tap away under "Learn more";
 * "Don't remind me" hides the note everywhere, and Settings → Help keeps the explanation.
 */
export function MediaNote({ explanation, missing }: { explanation: MediaExplanation; missing: number }) {
  const { t, settings } = useApp();
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  if (explanation.severity === "none" || settings.hideMediaNote) return null;

  return (
    <View style={styles.box}>
      <Text style={styles.line}>{t("media.note", { count: String(missing) })}</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>{open ? t("common.showLess") : t("common.learnMore")}</Text>
        </Pressable>
        <Pressable
          onPress={() => updateSettings({ hideMediaNote: true })}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.quiet}>{t("media.note.dismiss")}</Text>
        </Pressable>
      </View>
      {open &&
        explanation.causes.map((cause) => (
          <Text key={cause.what} style={styles.detail}>
            {cause.what}. {cause.why}
          </Text>
        ))}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  box: { gap: space.xs, paddingVertical: space.xs },
  line: { fontSize: 13.5, lineHeight: 20, color: t.muted, writingDirection: "auto" },
  actions: { flexDirection: "row", gap: space.lg },
  link: { fontSize: 13, fontWeight: "600", color: t.accent },
  quiet: { fontSize: 13, color: t.muted },
  detail: { fontSize: 13, lineHeight: 19, color: t.body, writingDirection: "auto" },
}));
