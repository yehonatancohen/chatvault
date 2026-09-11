import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createStyles, useApp } from "../components/app/providers";
import { Button, Callout, CalloutText, CheckRow, Section, Step } from "../components/app/ui";
import { radius, space } from "../lib/ui/theme";
import type { StringKey } from "../lib/i18n/strings";

/**
 * A6 — guided delete.
 *
 * **This screen deletes nothing, and must never appear to.** There is no API for deleting a
 * WhatsApp chat and there never will be one; root CLAUDE.md invariant 1 says any UI string
 * claiming we free storage directly is a bug. So this is instructions and a confirmation the
 * user gives *us*, describing something they did themselves in another app.
 *
 * The tone is deliberately unhurried. Everything from here is irreversible and performed by the
 * user's own hands, and the honest framing is "here is how, when you are ready" — never a
 * celebration or a nudge. The one piece of pressure the screen does apply is in the other
 * direction: a last reminder to go back and check the numbers.
 */

const STEP_KEYS = [1, 2, 3, 4] as const;

export default function DeleteGuideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string }>();
  const { t } = useApp();
  const styles = useStyles();

  const [confirmed, setConfirmed] = useState(false);

  const chat = params.title ?? t("deleteGuide.theChat");
  const platform = Platform.OS === "ios" ? "ios" : "android";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{t("deleteGuide.heading", { chat })}</Text>
      <Text style={styles.body}>{t("deleteGuide.body")}</Text>

      <Callout tone="caution" title={t("deleteGuide.before.title")}>
        <CalloutText>{t("deleteGuide.before.body")}</CalloutText>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}
        >
          <Text style={styles.inlineButtonLabel}>{t("deleteGuide.before.cta")}</Text>
        </Pressable>
      </Callout>

      <Section title={t(`deleteGuide.steps.${platform}` as StringKey)}>
        <View style={styles.steps}>
          {STEP_KEYS.map((index) => (
            <Step
              key={index}
              index={index}
              text={t(`deleteGuide.${platform}.${index}` as StringKey)}
            />
          ))}
        </View>
      </Section>

      <Callout tone="neutral" title={t("deleteGuide.clear.title")}>
        <CalloutText>{t("deleteGuide.clear.body")}</CalloutText>
      </Callout>

      <CheckRow
        label={t("deleteGuide.confirm")}
        checked={confirmed}
        onToggle={() => setConfirmed((value) => !value)}
      />

      {confirmed && <Text style={styles.confirmedNote}>{t("deleteGuide.confirmed")}</Text>}

      <Button label={t("common.done")} onPress={() => router.replace("/")} />
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: 48, gap: space.md + 2 },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: t.ink,
    letterSpacing: -0.4,
    writingDirection: "auto",
  },
  body: { fontSize: 15, lineHeight: 23, color: t.body, writingDirection: "auto" },
  steps: { gap: space.lg, paddingVertical: space.xs },
  inlineButton: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: t.hairline,
    backgroundColor: t.paper,
  },
  inlineButtonLabel: { fontSize: 14, fontWeight: "700", color: t.ink, writingDirection: "auto" },
  pressed: { opacity: 0.65 },
  confirmedNote: { fontSize: 13, lineHeight: 20, color: t.muted, writingDirection: "auto" },
}));
