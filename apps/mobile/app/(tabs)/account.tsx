import { useCallback, useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { createStyles, useApp } from "../../components/app/providers";
import { Actions, Body, Button, Row, Screen, Section } from "../../components/app/ui";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  restoreGoogleConnection,
  type GoogleConnection,
} from "../../lib/drive/google-auth";
import { backupAll, listRestorable, restoreArchive } from "../../lib/drive/device-sync";
import { formatCount } from "../../lib/ui/format";
import { radius, space, type } from "../../lib/ui/theme";
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
  const { t, tp } = useApp();
  const styles = useStyles();
  const [google, setGoogle] = useState<GoogleConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [restorable, setRestorable] = useState<string[] | undefined>(undefined);
  const [restoring, setRestoring] = useState<number | undefined>(undefined);

  useEffect(() => {
    restoreGoogleConnection()
      .then(setGoogle)
      .catch(() => setGoogle(null));
  }, []);

  useEffect(() => {
    if (!google?.hasDrive) {
      setRestorable(undefined);
      return;
    }
    listRestorable()
      .then(setRestorable)
      .catch(() => setRestorable(undefined));
  }, [google]);

  const act = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setRestoring(undefined);
    }
  }, []);

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
  const restore = () =>
    act(async () => {
      for (const [i, archiveId] of (restorable ?? []).entries()) {
        setRestoring(i + 1);
        await restoreArchive(archiveId);
      }
      setRestorable([]);
      setMessage(t("account.restored"));
    });

  const connected = google?.hasDrive === true;

  // Not connected: this is the app's account/sign-in moment, so it reads like one — the sign, a
  // headline on an ultramarine field (the tutorial's first page, again) and one primary action.
  // What connecting gets you is in Settings → Help, per the minimal-text rule.
  if (!connected) {
    return (
      <Screen>
        <View style={styles.hero}>
          <Image source={appMark} style={styles.mark} accessibilityLabel="" />
          <Text style={styles.headline}>{t("account.drive.pitch")}</Text>
        </View>

        <Actions>
          <Button label={t("account.drive.connect")} onPress={() => void connect()} disabled={busy} />
        </Actions>
        {message !== undefined && <Body muted>{message}</Body>}
      </Screen>
    );
  }

  return (
    <Screen>
      <Section title={t("account.drive.title")} footnote={message}>
        <Row label={t("account.drive.account")} value={google.email} />
      </Section>

      <Actions>
        <Button label={t("account.drive.backupAll")} onPress={() => void backUp()} disabled={busy} />
        {restorable !== undefined && restorable.length > 0 && (
          <Button
            label={
              restoring !== undefined
                ? t("account.drive.restoring", {
                    n: formatCount(restoring),
                    count: formatCount(restorable.length),
                  })
                : t("account.drive.restore", { count: tp("common.chats", restorable.length) })
            }
            tone="quiet"
            onPress={() => void restore()}
            disabled={busy}
          />
        )}
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
  hero: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.card,
    backgroundColor: t.sign,
  },
  mark: { width: 64, height: 64, borderRadius: radius.chip, marginBottom: space.sm },
  headline: { ...type.display, fontSize: 28, lineHeight: 34, color: t.onSign, textAlign: "left", writingDirection: "auto" },
}));
