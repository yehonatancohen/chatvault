import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { createStyles, useApp } from "../../components/app/providers";
import { Callout, CalloutText, ChoiceRow, LinkRow, Row, Section, SwitchRow } from "../../components/app/ui";
import { directionNeedsRestart } from "../../lib/i18n/bootstrap";
import { updateSettings } from "../../lib/settings/settings";
import { space } from "../../lib/ui/theme";

/**
 * Settings — and the way into Help, which is where every explanation in the app now lives.
 *
 * **The language notice is the one piece of real complexity.** Text is React and swaps
 * instantly; layout direction is a native flag read when the view hierarchy is built, so it
 * only takes effect on the next launch (`lib/i18n/bootstrap.ts` explains why this cannot be
 * fixed from here). The screen shows the notice exactly while it is true —
 * `directionNeedsRestart` compares the live `I18nManager.isRTL` against the chosen language.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { t, settings, setLanguage, setAppearance } = useApp();
  const styles = useStyles();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title={t("settings.chats.title")}>
        <SwitchRow
          label={t("settings.protectNewChats")}
          value={settings.protectNewChats}
          onChange={(value) => updateSettings({ protectNewChats: value })}
        />
        <SwitchRow
          label={t("settings.mediaNote")}
          value={!settings.hideMediaNote}
          onChange={(value) => updateSettings({ hideMediaNote: !value })}
        />
      </Section>

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

      {directionNeedsRestart(settings.language) && (
        <Callout tone="caution">
          <CalloutText>{t("settings.language.restart")}</CalloutText>
        </Callout>
      )}

      <Section title={t("settings.appearance.title")}>
        <ChoiceRow
          label={t("settings.appearance.system")}
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

      <Section>
        <LinkRow label={t("settings.help")} onPress={() => router.push("/help")} />
        <Row label={t("settings.about.version")} value={Constants.expoConfig?.version ?? "-"} />
      </Section>

      {/*
        Dev builds only (`__DEV__` is false in a release bundle): the storage and crypto checks
        cannot run in CI, so this is where they run.
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

const useStyles = createStyles(() => ({
  container: { padding: space.xl, paddingBottom: space.xxl + space.lg, gap: space.xs },
}));
