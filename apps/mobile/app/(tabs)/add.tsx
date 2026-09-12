import { View } from "react-native";
import { createStyles, useApp } from "../../components/app/providers";
import { Body, Screen, Step } from "../../components/app/ui";
import { space } from "../../lib/ui/theme";

/**
 * How to add a chat: five steps and nothing else. Limits, merging and privacy are explained in
 * Settings → Help.
 */
export default function AddScreen() {
  const { t } = useApp();
  const styles = useStyles();

  return (
    <Screen>
      <View style={styles.steps}>
        <Step index={1} text={t("add.step.1")} />
        <Step index={2} text={t("add.step.2")} />
        <Step index={3} text={t("add.step.3")} />
        <Step index={4} text={t("add.step.4")} />
        <Step index={5} text={t("add.step.5")} />
      </View>
      <Body muted>{t("add.after")}</Body>
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  steps: { gap: space.xl },
}));
