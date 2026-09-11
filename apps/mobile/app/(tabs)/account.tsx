import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { listArchiveIds } from "../../lib/archive/vault";
import { createStyles, useApp } from "../../components/app/providers";
import { Callout, CalloutText, Row, Section } from "../../components/app/ui";
import { formatCount } from "../../lib/ui/format";
import { space } from "../../lib/ui/theme";

/**
 * The Account tab — which is, today, an honest account of there being no account yet.
 *
 * Accounts are coming (`ACCOUNTS-AND-CLOUD.md`, Phase 1), and this is where sign-in will live.
 * Until they exist, the page must say what is true *now* — no sign-up, no login, nothing
 * uploaded — rather than grow a fake profile or a "coming soon" email capture. When Phase 1
 * lands, rewrite the copy here and `info.saved.noAccount` together: chats will still never be
 * stored on our servers (root `CLAUDE.md` invariant 2), but "no account and no server" will stop
 * being true.
 *
 * The "Today" block is the part that earns the tab. It is read from the device rather than
 * written as copy: the archive count comes from `listArchiveIds()`, so the one number here is a
 * fact about this phone rather than an assertion, and "Uploaded: nothing, ever" sits beside it
 * as the same kind of statement.
 */
export default function AccountScreen() {
  const { t } = useApp();
  const styles = useStyles();
  const [archiveCount, setArchiveCount] = useState(0);

  // On focus rather than on mount: an import can happen between visits to this tab, and a
  // count that disagrees with the chat list is exactly the sort of small wrongness that makes
  // the rest of the screen's claims less believable.
  useFocusEffect(
    useCallback(() => {
      setArchiveCount(listArchiveIds().length);
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>{t("account.none.title")}</Text>
        <Text style={styles.body}>{t("account.none.body")}</Text>
      </View>

      <Section title={t("account.status.title")}>
        <Row label={t("account.status.signedIn")} value={t("account.status.signedInValue")} />
        <Row label={t("account.status.storage")} value={t("account.status.storageValue")} />
        <Row label={t("account.status.uploaded")} value={t("account.status.uploadedValue")} />
        <Row label={t("account.status.archives")} value={formatCount(archiveCount)} />
      </Section>

      <Callout tone="neutral" title={t("account.why.title")}>
        <CalloutText>{t("account.why.body")}</CalloutText>
        <CalloutText>{t("account.why.promise")}</CalloutText>
      </Callout>

      <Text style={styles.footnote}>{t("account.footnote")}</Text>
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: space.xxl + space.lg, gap: space.xs },
  hero: { paddingTop: space.sm, gap: space.sm + 2 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: t.ink,
    letterSpacing: -0.4,
    writingDirection: "auto",
  },
  body: { fontSize: 16, lineHeight: 24, color: t.body, writingDirection: "auto" },
  footnote: {
    marginTop: space.xl,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    writingDirection: "auto",
  },
}));
