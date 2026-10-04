import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { accountEmail, sessionGeneration, useDriveSession } from "../../lib/drive/session";
import { visibleArchiveIds, pendingArchiveIds } from "../../lib/archive/catalog";
import { readViewBackupState } from "../../lib/archive/location";
import { createStyles, useApp } from "../../components/app/providers";
import { Actions, Body, Button, Row, Screen, Section } from "../../components/app/ui";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  restoreGoogleConnection,
  type GoogleConnection,
} from "../../lib/drive/google-auth";
import { backupAll } from "../../lib/drive/device-sync";
import { formatCount } from "../../lib/ui/format";
import { space, type } from "../../lib/ui/theme";
import appMark from "../../assets/images/mark.png";

/**
 * The Account tab: today, the Google account whose Drive keeps copies of the user's chats.
 *
 * Kept to actions — connect, back up everything, restore what's in Drive but not on this phone,
 * disconnect. What Drive holds and who can read it is explained in Settings → Help. Boydem
 * accounts proper (`ACCOUNTS-AND-CLOUD.md`) will live here too; chats will still never be stored
 * on our servers (root `CLAUDE.md`, invariant 2).
 */
export default function AccountScreen() {
  const { t } = useApp();
  const styles = useStyles();
  const [google, setGoogle] = useState<GoogleConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const session = useDriveSession();
  const request = useRef(0);
  const [counts, setCounts] = useState<{ cloud: number; pending: number } | undefined>(undefined);

  useEffect(() => {
    let stale = false;
    restoreGoogleConnection()
      .then(connection => { if (!stale) setGoogle(connection); })
      .catch(() => { if (!stale) setGoogle(null); });
    return () => { stale = true; };
  }, [session]);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    const generation = sessionGeneration();
    setCounts(undefined);
    try {
      const ids = await visibleArchiveIds();
      const pending = await pendingArchiveIds();
      const states = await Promise.all(ids.map(readViewBackupState));
      if (current !== request.current || generation !== sessionGeneration()) return;
      setCounts({ cloud: states.filter(s => s.backedUpAt !== undefined && s.accountEmail === accountEmail()).length, pending: pending.length });
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }, [session]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const act = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [refresh]);

  const connect = () => act(async () => setGoogle(await connectGoogleDrive()));
  const disconnect = () =>
    act(async () => {
      await disconnectGoogleDrive();
      setGoogle(null);
    });
  const backUp = () =>
    act(async () => {
      const { ok, failed } = await backupAll();
      setMessage(
        failed === 0
          ? t("account.backedUp", { count: formatCount(ok) })
          : t("account.backedUpSome", { ok: formatCount(ok), failed: formatCount(failed) }),
      );
    });
  const connected = google?.hasDrive === true && google.email === accountEmail();

  // Not connected: this is the app's account/sign-in moment, so it reads like the system's own —
  // the app's icon, one centred line saying what signing in is for, and one primary action.
  // What connecting gets you is in Settings → Help, per the minimal-text rule.
  if (!connected) {
    return (
      <Screen largeTitle={t("account.title")}>
        <View style={styles.hero}>
          <Image source={appMark} style={styles.mark} accessibilityLabel="" />
          <Text style={styles.headline}>{t("account.drive.pitch")}</Text>
        </View>

        <Body muted>{t("account.drive.signedOutNote")}</Body>
        <Actions>
          <Button label={t("account.drive.connect")} onPress={() => void connect()} disabled={busy} />
        </Actions>
        {message !== undefined && <Body muted>{message}</Body>}
      </Screen>
    );
  }

  return (
    <Screen largeTitle={t("account.title")}>
      <Section title={t("account.drive.title")} footnote={message}>
        <Row label={t("account.drive.account")} value={google?.email ?? ""} />
      </Section>

      <Section footnote={t("account.drive.storageNote")}>
        <Row label={t("account.drive.cloudCount")} value={counts ? formatCount(counts.cloud) : "…"} />
        <Row label={t("account.drive.pendingCount")} value={counts ? formatCount(counts.pending) : "…"} />
      </Section>
      <Actions>
        {counts !== undefined && counts.pending > 0 && <Button label={t("account.drive.backupAll")} onPress={() => void backUp()} disabled={busy} />}
        <Button label={t("account.drive.refresh")} tone="quiet" onPress={() => void refresh()} disabled={busy} />
        <Button
          label={t("account.drive.disconnect")}
          tone="quiet"
          onPress={() => void disconnect()}
          disabled={busy}
        />
      </Actions>
    </Screen>
  );
}


const useStyles = createStyles((t) => ({
  hero: { alignItems: "center", gap: space.lg, paddingVertical: space.xl },
  // An app icon's own proportions: the corner is 22.37% of the side.
  mark: { width: 80, height: 80, borderRadius: 18, borderCurve: "continuous" },
  headline: { ...type.title, color: t.ink, textAlign: "center", writingDirection: "auto", maxWidth: 320 },
}));
