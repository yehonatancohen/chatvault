import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { createStyles, useApp } from "../../components/app/providers";
import { Button, Row, Section } from "../../components/app/ui";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  restoreGoogleConnection,
  type GoogleConnection,
} from "../../lib/drive/google-auth";
import { backupAll, listRestorable, restoreArchive } from "../../lib/drive/device-sync";
import { formatCount } from "../../lib/ui/format";
import { space } from "../../lib/ui/theme";

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title={t("account.drive.title")}>
        {!connected ? (
          <>
            <Text style={styles.body}>{t("account.drive.pitch")}</Text>
            <Button label={t("account.drive.connect")} onPress={() => void connect()} disabled={busy} />
          </>
        ) : (
          <>
            <Row label={t("account.drive.account")} value={google.email} />
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
            <Button label={t("account.drive.disconnect")} tone="quiet" onPress={() => void disconnect()} disabled={busy} />
          </>
        )}
        {message !== undefined && (
          <Text style={styles.muted} selectable>
            {message}
          </Text>
        )}
      </Section>
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: space.xxl, gap: space.md },
  body: { fontSize: 15, lineHeight: 22, color: t.body, writingDirection: "auto" },
  muted: { fontSize: 13.5, lineHeight: 20, color: t.muted, writingDirection: "auto" },
}));
