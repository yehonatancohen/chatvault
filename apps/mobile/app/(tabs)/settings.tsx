import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { FORMAT_VERSION } from "@chatvault/core";
import { readLibrary } from "../../lib/archive/library";
import { createStyles, useApp } from "../../components/app/providers";
import { Callout, CalloutText, ChoiceRow, LinkRow, Row, Section } from "../../components/app/ui";
import { directionNeedsRestart } from "../../lib/i18n/bootstrap";
import { formatBytes, formatCount } from "../../lib/ui/format";
import { space } from "../../lib/ui/theme";

/**
 * Settings.
 *
 * Two choices that change the app, and two blocks that only report. The reporting half is not
 * padding: "how much is this holding and where" is the question this product exists to answer,
 * and a settings screen that cannot answer it about itself is a settings screen for a different
 * app.
 *
 * **The language notice is the one piece of real complexity.** Text is React and swaps
 * instantly; layout direction is a native flag read when the view hierarchy is built, so it
 * only takes effect on the next launch (`lib/i18n/bootstrap.ts` explains why this cannot be
 * fixed from here). Rather than hide that, the screen shows the notice exactly while it is
 * true — `directionNeedsRestart` compares the live `I18nManager.isRTL` against the chosen
 * language — so it appears the moment the setting diverges and is gone by itself after the
 * relaunch, without anything having to remember that a change happened.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { t, settings, setLanguage, setAppearance, language } = useApp();
  const styles = useStyles();

  const [totals, setTotals] = useState<{ archives: number; bytes: number }>({
    archives: 0,
    bytes: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let stale = false;
      void (async () => {
        const entries = await readLibrary(language);
        if (stale) return;
        setTotals({
          archives: entries.length,
          bytes: entries.reduce(
            (sum, entry) =>
              sum + (entry.manifest?.media.reduce((n, ref) => n + ref.byteLength, 0) ?? 0),
            0,
          ),
        });
      })();
      return () => {
        stale = true;
      };
    }, [language]),
  );

  const restartNeeded = directionNeedsRestart(settings.language);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title={t("settings.language.title")}>
        <ChoiceRow
          label={t("settings.language.he")}
          selected={settings.language === "he"}
          onPress={() => setLanguage("he")}
        />
        <ChoiceRow
          label={t("settings.language.en")}
          selected={settings.language === "en"}
          onPress={() => setLanguage("en")}
        />
      </Section>

      {restartNeeded && (
        <Callout tone="caution">
          <CalloutText>{t("settings.language.restart")}</CalloutText>
        </Callout>
      )}

      <Section title={t("settings.appearance.title")}>
        <ChoiceRow
          label={t("settings.appearance.system")}
          note={t("settings.appearance.systemNote")}
          selected={settings.appearance === "system"}
          onPress={() => setAppearance("system")}
        />
        <ChoiceRow
          label={t("settings.appearance.light")}
          selected={settings.appearance === "light"}
          onPress={() => setAppearance("light")}
        />
        <ChoiceRow
          label={t("settings.appearance.dark")}
          selected={settings.appearance === "dark"}
          onPress={() => setAppearance("dark")}
        />
      </Section>

      <Section title={t("settings.storage.title")}>
        <Row label={t("settings.storage.archives")} value={formatCount(totals.archives)} />
        <Row label={t("settings.storage.media")} value={formatBytes(totals.bytes)} />
      </Section>

      <Section title={t("settings.about.title")}>
        <Row
          label={t("settings.about.version")}
          value={Constants.expoConfig?.version ?? "-"}
        />
        {/*
          Surfaced because archives outlive app versions (root CLAUDE.md, invariant 4): someone
          opening a two-year-old vault, or comparing a phone against the web viewer, needs a way
          to see which shape it is without a debugger.
        */}
        <Row label={t("settings.about.format")} value={String(FORMAT_VERSION)} />
      </Section>
      <Text style={styles.about}>{t("settings.about.body")}</Text>

      {/*
        Dev builds only. The storage adapter's conformance suite cannot run in CI — the
        filesystem it uses is a native module — so the only way to run it is from inside the
        app. `__DEV__` is false in a release bundle, so this never reaches a user. It moved here
        from the bottom of the library screen, which is a user-facing surface.
      */}
      {__DEV__ && (
        <Section title={t("settings.dev.title")}>
          <LinkRow
            label={t("settings.dev.checks")}
            note={t("settings.dev.checksNote")}
            onPress={() => router.push("/dev-storage")}
          />
        </Section>
      )}
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: space.xxl + space.lg, gap: space.xs },
  about: {
    marginTop: space.md,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    writingDirection: "auto",
  },
}));
