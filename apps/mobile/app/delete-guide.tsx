import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createStyles, useApp } from "../components/app/providers";
import { Actions, Button, CheckRow, Screen, Section, Step, Title } from "../components/app/ui";
import { readPreferences, updatePreferences } from "../lib/archive/preferences";
import { space } from "../lib/ui/theme";
import type { StringKey } from "../lib/i18n/strings";

/**
 * A6 — how to delete the chat in WhatsApp, yourself.
 *
 * The app deletes nothing and cannot (root CLAUDE.md, invariant 1): this screen shows the steps
 * and records the user's own confirmation, which is what turns the chat's status to "Deleted".
 * Why it is safe, and what happens to media, is in Settings → Help.
 *
 * The confirmation sits on its own surface below the steps rather than inline with them: it is
 * not a sixth instruction, it is the thing the user tells *us* once the other four are done.
 */

const STEP_KEYS = [1, 2, 3, 4] as const;

export default function DeleteGuideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; title?: string }>();
  const { t } = useApp();
  const styles = useStyles();
  const [confirmed, setConfirmed] = useState(false);

  const chat = params.title ?? t("deleteGuide.theChat");
  const platform = Platform.OS === "ios" ? "ios" : "android";

  useEffect(() => {
    if (params.id === undefined) return;
    void readPreferences(params.id).then((prefs) => setConfirmed(prefs.deletedInWhatsAppAt !== undefined));
  }, [params.id]);

  const toggle = () => {
    const next = !confirmed;
    setConfirmed(next);
    if (params.id !== undefined) {
      void updatePreferences(params.id, { deletedInWhatsAppAt: next ? Date.now() : undefined });
    }
  };

  return (
    <Screen>
      <Title text={t("deleteGuide.heading", { chat })} />

      <View style={styles.steps}>
        {STEP_KEYS.map((index) => (
          <Step key={index} index={index} text={t(`deleteGuide.${platform}.${index}` as StringKey)} />
        ))}
      </View>

      <Section>
        <CheckRow label={t("deleteGuide.confirm")} checked={confirmed} onToggle={toggle} />
      </Section>

      <Actions>
        <Button label={t("common.done")} onPress={() => router.replace("/")} />
      </Actions>
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  steps: { gap: space.xl },
}));
