import { ScrollView, Text, View } from "react-native";
import { createStyles, useApp } from "../../components/app/providers";
import { Step } from "../../components/app/ui";
import { space } from "../../lib/ui/theme";

/**
 * How to add a chat: five steps and nothing else. Limits, merging and privacy are explained in
 * Settings → Help.
 */
export default function AddScreen() {
  const { t } = useApp();
  const styles = useStyles();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.steps}>
        <Step index={1} text={t("add.step.1")} />
        <Step index={2} text={t("add.step.2")} />
        <Step index={3} text={t("add.step.3")} />
        <Step index={4} text={t("add.step.4")} />
        <Step index={5} text={t("add.step.5")} />
      </View>
      <Text style={styles.note}>{t("add.after")}</Text>
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: space.xxl, gap: space.xl },
  steps: { gap: space.lg },
  note: { fontSize: 14, lineHeight: 21, color: t.muted, writingDirection: "auto" },
}));
