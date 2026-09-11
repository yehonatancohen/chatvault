import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  backupArchive,
  isDriveConnected,
  watchBackup,
  type BackupStatus,
} from "../../lib/drive/device-sync";
import { formatCount, formatDateTime } from "../../lib/ui/format";
import { space } from "../../lib/ui/theme";
import { createStyles, useApp } from "../app/providers";
import { Button } from "../app/ui";

/**
 * Whether this chat is in the user's Google Drive, and the way to put it there.
 *
 * On Verify it starts a backup by itself (`autoStart`): the moment a chat has just been
 * archived is the moment a second copy matters most, and the user should not have to find a
 * button for it. In chat info it is the status and a manual "Back up now".
 *
 * Every state says what is true, including the unwelcome ones: a backup that failed says so and
 * resumes on retry; a Drive copy another phone changed is reported and left alone, never
 * overwritten. "Only on this phone" is shown plainly when Drive is not connected — it is the
 * single most useful fact for someone about to delete the original chat.
 */
export function DriveBackup({ archiveId, autoStart = false }: { archiveId: string; autoStart?: boolean }) {
  const { t } = useApp();
  const styles = useStyles();
  const [connected, setConnected] = useState<boolean | undefined>(undefined);
  const [status, setStatus] = useState<BackupStatus>({ kind: "idle" });
  const started = useRef(false);

  useEffect(() => watchBackup(archiveId, setStatus), [archiveId]);

  useEffect(() => {
    let stale = false;
    void isDriveConnected().then((value) => {
      if (stale) return;
      setConnected(value);
      if (value && autoStart && !started.current) {
        started.current = true;
        void backupArchive(archiveId);
      }
    });
    return () => {
      stale = true;
    };
  }, [archiveId, autoStart]);

  if (connected === undefined) return null;
  if (!connected) return <Text style={styles.muted}>{t("backup.notConnected")}</Text>;

  switch (status.kind) {
    case "running":
      return (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.body}>
            {t("backup.running")}
            {status.progress !== undefined
              ? ` ${t("backup.progress", {
                  done: formatCount(status.progress.done),
                  total: formatCount(status.progress.total),
                })}`
              : ""}
          </Text>
        </View>
      );
    case "done":
      return <Text style={styles.good}>{t("backup.done", { when: formatDateTime(status.backedUpAt) })}</Text>;
    case "diverged":
      return <Text style={styles.bad}>{t("backup.diverged")}</Text>;
    case "failed":
      return (
        <View style={styles.stack}>
          <Text style={styles.bad} selectable>
            {t("backup.failed", { message: status.message })}
          </Text>
          <Button label={t("backup.retry")} tone="quiet" onPress={() => void backupArchive(archiveId)} />
        </View>
      );
    case "idle":
      return (
        <View style={styles.stack}>
          <Text style={status.backedUpAt !== undefined ? styles.good : styles.body}>
            {status.backedUpAt !== undefined
              ? t("backup.done", { when: formatDateTime(status.backedUpAt) })
              : t("backup.never")}
          </Text>
          <Button label={t("backup.now")} tone="quiet" onPress={() => void backupArchive(archiveId)} />
        </View>
      );
  }
}

const useStyles = createStyles((t) => ({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stack: { gap: space.xs },
  body: { fontSize: 14, lineHeight: 21, color: t.body, writingDirection: "auto", flexShrink: 1 },
  muted: { fontSize: 13.5, lineHeight: 20, color: t.muted, writingDirection: "auto" },
  good: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: t.good, writingDirection: "auto" },
  bad: { fontSize: 13.5, lineHeight: 20, color: t.bad, writingDirection: "auto" },
}));
