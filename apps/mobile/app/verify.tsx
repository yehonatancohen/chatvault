import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "../components/app/Icon";
import { useRouter } from "expo-router";
import { takeImportSession, type ImportSession } from "../lib/import/session";
import { createStyles, useApp } from "../components/app/providers";
import { Actions, Body, Button, EmptyState, Row, Screen, Section, Stat } from "../components/app/ui";
import { DriveBackup } from "../components/archive/DriveBackup";
import { MediaNote } from "../components/archive/MediaNote";
import { useChatStatus } from "../components/archive/useChatStatus";
import { formatBytes, formatCount, formatRange } from "../lib/ui/format";
import { explainMedia } from "../lib/ui/media-explanation";
import { space, type } from "../lib/ui/theme";

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
 * **The counts are the screen.** They used to be a stack of body-copy lines, which is how you
 * write a receipt, not how you show evidence: this is the moment a user decides whether it is
 * safe to delete their only other copy, so the outcome is the system's own confirmation — a
 * green checkmark, what was saved — and the two numbers that answer the question lead the group
 * below it at Large Title's size, with everything else deferring to them.
 *
 * Nothing here claims to free storage or delete anything (root CLAUDE.md, invariant 1).
 */
export default function VerifyScreen() {
  const router = useRouter();
  const { t, tp, language } = useApp();
  const styles = useStyles();
  const [session, setSession] = useState<ImportSession | undefined>(undefined);
  const status = useChatStatus(session?.archiveId ?? "", session?.outcome.manifest.updatedAt ?? 0);

  useEffect(() => {
    // Read once, on mount. A cold start onto this route has no session — see the fallback.
    setSession(takeImportSession());
  }, []);

  if (!session) {
    return (
      <Screen>
        <EmptyState
          heading={t("verify.nothing.heading")}
          action={{ label: t("common.backToLibrary"), onPress: () => router.replace("/") }}
        />
      </Screen>
    );
  }

  const { outcome } = session;
  const { stats } = outcome;
  const media = explainMedia(stats, session.hadMedia, language);
  const added = outcome.mode === "appended" && outcome.addedCount > 0;
  // The way to the delete guide appears once the chat is "safe to delete" — its latest version in
  // the user's Drive — which is the promise the tutorial makes. While it is only on this phone the
  // screen says so (DriveBackup) and offers nothing that would lead to deleting the other copy.
  const deletable = status.kind === "safe" || status.kind === "deleted";

  return (
    <Screen>
      <View style={styles.outcome}>
        <Icon name="saved" color={styles.outcomeMark.color} size={56} weight="regular" />
        <Text style={styles.outcomeLabel}>
          {outcome.mode === "created" || outcome.addedCount > 0 ? t("verify.saved") : t("verify.nothingNew")}
        </Text>
        <Text style={styles.chat} numberOfLines={2}>
          {session.chatTitle}
        </Text>
      </View>

      <Section>
        <View style={styles.stats}>
          <Stat
            value={formatCount(outcome.messageCount)}
            label={
              added
                ? t("verify.added", { count: formatCount(outcome.addedCount) })
                : t("verify.row.messages")
            }
          />
          {stats.uniqueBlobCount > 0 && (
            <Stat value={formatCount(stats.uniqueBlobCount)} label={t("verify.row.mediaFiles")} />
          )}
        </View>
        {/* `totalBytes` counts media only, so a text-only chat would read "0 B" — a size claim
            that is false at the moment a user decides whether to delete. */}
        {stats.totalBytes > 0 && <Row label={t("info.size")} value={formatBytes(stats.totalBytes)} />}
        <Row label={t("verify.range")} value={formatRange(outcome.firstTs, outcome.lastTs)} />
      </Section>

      <MediaNote explanation={media} missing={stats.notArchivedCount} />
      {outcome.issues.length > 0 && (
        <Body muted>{t("verify.issues", { count: formatCount(outcome.issues.length) })}</Body>
      )}

      <DriveBackup archiveId={session.archiveId} updatedAt={outcome.manifest.updatedAt} autoStart />

      <Actions>
        <Button
          label={t("verify.cta.read")}
          onPress={() => router.push({ pathname: "/archive/[id]", params: { id: session.archiveId } })}
        />
        {deletable && (
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
        )}
        <Button label={t("common.done")} tone="quiet" onPress={() => router.replace("/")} />
      </Actions>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  // The outcome, centred: a mark, what happened, and which chat it happened to. Green because
  // "saved" is information here, not decoration — it is the claim the screen exists to make.
  outcome: { alignItems: "center", gap: space.xs, paddingTop: space.md },
  outcomeMark: { color: t.good },
  outcomeLabel: { ...type.title, color: t.ink, textAlign: "center", writingDirection: "auto", marginTop: space.sm },
  chat: { ...type.body, color: t.muted, textAlign: "center", writingDirection: "auto" },
  // Side by side, and the row is what makes them read as one claim about the archive rather
  // than two unrelated figures.
  stats: { flexDirection: "row", gap: space.xxl, flexWrap: "wrap", paddingVertical: space.lg },
}));
