import { View } from "react-native";
import { StepArt, type StepArtName } from "../components/app/StepArt";
import { createStyles, useApp } from "../components/app/providers";
import { Body, Screen, Step } from "../components/app/ui";
import type { StringKey } from "../lib/i18n/strings";
import { space } from "../lib/ui/theme";

/**
 * How to add a chat: five steps and nothing else. Limits, merging and privacy are explained in
 * Settings → Help.
 *
 * A modal sheet rather than its own tab — the content is five short instructions, not a
 * destination someone navigates to repeatedly. Reachable from the chat list's header button,
 * from Help, and from the tutorial's second slide.
 */

const STEPS: readonly StepArtName[] = ["open", "name", "export", "media", "pick"];

export default function AddChatScreen() {
  const { t, theme } = useApp();
  const styles = useStyles();

  return (
    <Screen>
      <View style={styles.steps}>
        {STEPS.map((art, i) => (
          <Step
            key={art}
            index={i + 1}
            text={t(`add.step.${i + 1}` as StringKey)}
            icon={<StepArt name={art} color={theme.accentSoft} />}
          />
        ))}
      </View>
      <Body muted>{t("add.after")}</Body>
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  steps: { gap: space.xl },
}));
