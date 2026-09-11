import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { listArchiveIds } from "../../lib/archive/vault";
import { createStyles, useApp } from "../../components/app/providers";
import { Button, Callout, CalloutText, Row, Section } from "../../components/app/ui";
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
 * The Account tab — which is, today, an honest account of there being no account yet.
 *
 * Accounts are coming (`ACCOUNTS-AND-CLOUD.md`, Phase 1), and this is where sign-in will live.
 * Until they exist, the page must say what is true *now* — no sign-up, no login, nothing
 * uploaded — rather than grow a fake profile or a "coming soon" email capture. When Phase 1
 * lands, rewrite the copy here and `info.saved.noAccount` together: chats will still never be
 * stored on our servers (root `CLAUDE.md` invariant 2), but "no account and no server" will stop
 * being true.
 *
 * The Google Drive section is the first real connection: sign in with Google, grant `drive.file`
 * access, and nothing else yet. It says plainly that connecting uploads nothing — copying chats
 * to Drive is the next step, and the "Uploaded: nothing, ever" row above must stay true until
 * it lands (and be rewritten when it does).
 *
 * The "Today" block is the part that earns the tab. It is read from the device rather than
 * written as copy: the archive count comes from `listArchiveIds()`, so the one number here is a
 * fact about this phone rather than an assertion, and "Uploaded: nothing, ever" sits beside it
 * as the same kind of statement.
 */
export default function AccountScreen() {
  const { t, tp } = useApp();
  const styles = useStyles();
  const [archiveCount, setArchiveCount] = useState(0);
  const [google, setGoogle] = useState<GoogleConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  useEffect(() => {
    let stale = false;
    restoreGoogleConnection()
      .then((connection) => {
        if (!stale) setGoogle(connection);
      })
      .catch(() => {
        // No usable session is the same as no session: the connect button is the way forward.
      });
    return () => {
      stale = true;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<GoogleConnection | null>) => {
    setBusy(true);
    setProblem(undefined);
    try {
      setGoogle(await action());
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const connect = useCallback(() => run(connectGoogleDrive), [run]);

  // What the user's Drive holds that this phone does not — a new phone's way back to its chats.
  const [restorable, setRestorable] = useState<string[] | undefined>(undefined);
  const [restore, setRestore] = useState<{ kind: "idle" } | { kind: "running"; n: number } | { kind: "done" }>({
    kind: "idle",
  });
  const [backupSummary, setBackupSummary] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!google?.hasDrive) {
      setRestorable(undefined);
      return;
    }
    let stale = false;
    listRestorable()
      .then((ids) => {
        if (!stale) setRestorable(ids);
      })
      .catch((error: unknown) => {
        if (!stale) setProblem(error instanceof Error ? error.message : String(error));
      });
    return () => {
      stale = true;
    };
  }, [google]);

  const backUpAll = useCallback(async () => {
    setBusy(true);
    setBackupSummary(undefined);
    try {
      const { ok, failed } = await backupAll();
      setBackupSummary(
        failed === 0
          ? t("account.drive.backupAllDone", { ok: formatCount(ok) })
          : t("account.drive.backupAllFailed", { ok: formatCount(ok), failed: formatCount(failed) }),
      );
    } finally {
      setBusy(false);
    }
  }, [t]);

  /** One at a time: each is a full download, and a phone on mobile data should not fan out. */
  const restoreAll = useCallback(async () => {
    if (restorable === undefined) return;
    setBusy(true);
    setProblem(undefined);
    try {
      for (const [i, archiveId] of restorable.entries()) {
        setRestore({ kind: "running", n: i + 1 });
        await restoreArchive(archiveId);
      }
      setRestore({ kind: "done" });
      setArchiveCount(listArchiveIds().length);
      setRestorable([]);
    } catch (error) {
      setRestore({ kind: "idle" });
      setProblem(error instanceof Error ? error.message : String(error));
      setRestorable(await listRestorable().catch(() => restorable));
    } finally {
      setBusy(false);
    }
  }, [restorable]);
  const disconnect = useCallback(
    () =>
      run(async () => {
        await disconnectGoogleDrive();
        return null;
      }),
    [run],
  );

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
        <Row
          label={t("account.status.drive")}
          value={google?.hasDrive ? google.email : t("account.status.driveNone")}
        />
        <Row
          label={t("account.status.storage")}
          value={t(google?.hasDrive ? "account.status.storageDrive" : "account.status.storageValue")}
        />
        <Row label={t("account.status.uploaded")} value={t("account.status.uploadedValue")} />
        <Row label={t("account.status.archives")} value={formatCount(archiveCount)} />
      </Section>

      <Section title={t("account.drive.title")}>
        <Text style={styles.sectionBody}>{t("account.drive.body")}</Text>
        {google === null || !google.hasDrive ? (
          <>
            {google !== null && <Text style={styles.warning}>{t("account.drive.noScope")}</Text>}
            <Button
              label={t("account.drive.connect")}
              onPress={() => void connect()}
              disabled={busy}
            />
          </>
        ) : (
          <>
            <Text style={styles.connected}>
              {t("account.drive.connected", { email: google.email })}
            </Text>
            <Text style={styles.sectionBody}>{t("account.drive.next")}</Text>
            <Button
              label={t("account.drive.backupAll")}
              onPress={() => void backUpAll()}
              disabled={busy || archiveCount === 0}
            />
            {backupSummary !== undefined && <Text style={styles.sectionBody}>{backupSummary}</Text>}

            {restorable !== undefined &&
              (restore.kind === "running" ? (
                <Text style={styles.sectionBody}>
                  {t("account.drive.restoring", {
                    n: formatCount(restore.n),
                    count: formatCount(restorable.length),
                  })}
                </Text>
              ) : restore.kind === "done" ? (
                <Text style={styles.connected}>{t("account.drive.restored")}</Text>
              ) : restorable.length === 0 ? (
                <Text style={styles.sectionBody}>{t("account.drive.restoreNone")}</Text>
              ) : (
                <>
                  <Text style={styles.sectionBody}>
                    {t("account.drive.restoreFound", {
                      count: tp("common.archives", restorable.length),
                    })}
                  </Text>
                  <Button label={t("account.drive.restore")} onPress={() => void restoreAll()} disabled={busy} />
                </>
              ))}

            <Button
              label={t("account.drive.disconnect")}
              tone="quiet"
              onPress={() => void disconnect()}
              disabled={busy}
            />
          </>
        )}
        {problem !== undefined && (
          <Text style={styles.warning} selectable>
            {t("account.drive.error", { message: problem })}
          </Text>
        )}
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
  sectionBody: { fontSize: 14, lineHeight: 21, color: t.body, writingDirection: "auto" },
  connected: { fontSize: 15, fontWeight: "600", color: t.good, writingDirection: "auto" },
  warning: { fontSize: 13.5, lineHeight: 20, color: t.bad, writingDirection: "auto" },
  footnote: {
    marginTop: space.xl,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    writingDirection: "auto",
  },
}));
