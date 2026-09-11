import { ScrollView, Text, View } from "react-native";
import { createStyles, useApp } from "../../components/app/providers";
import { Callout, CalloutText, Section, Step } from "../../components/app/ui";
import { space } from "../../lib/ui/theme";

/**
 * The Add tab — how a chat gets into this app at all.
 *
 * The `+` in the middle of the bar cannot open a picker, because there is nothing on this
 * device for it to pick: WhatsApp's export is produced inside WhatsApp and arrives through the
 * share sheet (root CLAUDE.md, invariant 7 — we never automate the app, read its databases or
 * scrape). So the tab teaches the one route in, which is the genuine obstacle between a new
 * user and their first archive.
 *
 * It exists as a tab rather than only as the library's empty state because a user who already
 * has one archive still has to find these steps to make a second, and an empty state is by
 * definition gone by then.
 *
 * **Step 4 is the one that matters.** "Attach Media" is the difference between an archive that
 * holds the photos and one that holds placeholders, and it is a choice WhatsApp presents once,
 * in a dialog, with no explanation. Getting it wrong is recoverable — a second export merges —
 * but only if the user understands what happened, which is what the Verify screen's media
 * wording then has to do the hard way.
 */
export default function AddScreen() {
  const { t } = useApp();
  const styles = useStyles();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.lede}>{t("add.lede")}</Text>

      <Section title={t("add.steps.title")}>
        <View style={styles.steps}>
          <Step index={1} text={t("add.step.1")} />
          <Step index={2} text={t("add.step.2")} />
          <Step index={3} text={t("add.step.3")} />
          <Step index={4} text={t("add.step.4")} />
          <Step index={5} text={t("add.step.5")} />
        </View>
      </Section>

      <Callout tone="neutral" title={t("add.waiting.title")}>
        <CalloutText>{t("add.waiting.body")}</CalloutText>
      </Callout>

      <Callout tone="good" title={t("add.merge.title")}>
        <CalloutText>{t("add.merge.body")}</CalloutText>
      </Callout>

      <Section title={t("add.limits.title")}>
        <Text style={styles.note}>{t("add.limits.cap")}</Text>
        <Text style={styles.note}>{t("add.limits.noDelete")}</Text>
      </Section>
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: space.xxl + space.lg, gap: space.xs },
  lede: { fontSize: 16, lineHeight: 24, color: t.body, writingDirection: "auto" },
  steps: { gap: space.lg, paddingVertical: space.sm },
  note: { fontSize: 14, lineHeight: 21, color: t.body, writingDirection: "auto" },
}));
