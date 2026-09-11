import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { takeImportSession, type ImportSession } from "../lib/import/session";
import { createStyles, useApp } from "../components/app/providers";
import { Button } from "../components/app/ui";
import { DriveBackup } from "../components/archive/DriveBackup";
import { MediaNote } from "../components/archive/MediaNote";
import { formatBytes, formatCount, formatRange } from "../lib/ui/format";
import { explainMedia } from "../lib/ui/media-explanation";
import { space } from "../lib/ui/theme";

/**
 * A5 — Verify: the chat is saved, here is what's in it.
 *
 * Kept to what a user needs in the moment: that it saved, how much, whether it's in their
 * Drive yet (a progress bar — the backup starts by itself), and what to do next. Two rules still
 * hold, both because the opposite is tempting:
 *
 * 1. **The numbers were read back out of the archive**, not remembered from the write
 *    (`run-import.ts`), so they describe the file.
 * 2. **Media the export didn't include is still said** — as one quiet sentence with "Learn
 *    more" (`MediaNote`), because it is normal, not alarming. The full explanation is computed
 *    in `explainMedia`, where it is tested, and is also in Settings → Help.
 *
 * Nothing here claims to free storage or delete anything (root CLAUDE.md, invariant 1).
 */
export default function VerifyScreen() {
  const router = useRouter();
  const { t, tp, language } = useApp();
  const styles = useStyles();
  const [session, setSession] = useState<ImportSession | undefined>(undefined);

  useEffect(() => {
    // Read once, on mount. A cold start onto this route has no session — see the fallback.
    setSession(takeImportSession());
  }, []);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>{t("verify.nothing.heading")}</Text>
        <Button label={t("common.backToLibrary")} onPress={() => router.replace("/")} />
      </View>
    );
  }

  const { outcome } = session;
  const { stats } = outcome;
  const media = explainMedia(stats, session.hadMedia, language);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.eyebrow}>
        {outcome.mode === "created" || outcome.addedCount > 0
          ? t("verify.saved")
          : t("verify.nothingNew")}
      </Text>
      <Text style={styles.heading}>{session.chatTitle}</Text>

      <View style={styles.facts}>
        <Text style={styles.fact}>
          {tp("common.messages", outcome.messageCount)}
          {outcome.mode === "appended" && outcome.addedCount > 0
            ? ` (${t("verify.added", { count: formatCount(outcome.addedCount) })})`
            : ""}
        </Text>
        <Text style={styles.fact}>{formatRange(outcome.firstTs, outcome.lastTs)}</Text>
        {stats.uniqueBlobCount > 0 && (
          <Text style={styles.fact}>
            {tp("common.files", stats.uniqueBlobCount)} · {formatBytes(stats.totalBytes)}
          </Text>
        )}
      </View>

      <MediaNote explanation={media} missing={stats.notArchivedCount} />
      {outcome.issues.length > 0 && (
        <Text style={styles.muted}>{t("verify.issues", { count: formatCount(outcome.issues.length) })}</Text>
      )}

      <View style={styles.drive}>
        <DriveBackup archiveId={session.archiveId} updatedAt={outcome.manifest.updatedAt} autoStart />
      </View>

      <View style={styles.buttons}>
        <Button
          label={t("verify.cta.read")}
          onPress={() => router.push({ pathname: "/archive/[id]", params: { id: session.archiveId } })}
        />
        <Button
          label={t("verify.cta.delete")}
          tone="quiet"
          onPress={() =>
            router.push({
              pathname: "/delete-guide",
              params: { id: session.archiveId, title: session.chatTitle },
            })
          }
        />
        <Button label={t("common.done")} tone="quiet" onPress={() => router.replace("/")} />
      </View>
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: 48, gap: space.sm },
  check: { fontSize: 40, color: t.good, textAlign: "center", marginTop: space.lg },
  eyebrow: { fontSize: 14, fontWeight: "700", color: t.good, textAlign: "center" },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: t.ink,
    textAlign: "center",
    writingDirection: "auto",
  },
  facts: { alignItems: "center", gap: 2, marginVertical: space.sm },
  fact: { fontSize: 15, color: t.body, writingDirection: "auto" },
  muted: { fontSize: 13, color: t.muted, writingDirection: "auto" },
  drive: { marginTop: space.md, marginBottom: space.md },
  buttons: { gap: space.xs },
}));
