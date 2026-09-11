import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  backupArchive,
  isDriveConnected,
  watchBackup,
  type BackupStatus,
} from "../../lib/drive/device-sync";
import { readBackupState } from "../../lib/drive/backup-state";
import { space } from "../../lib/ui/theme";
import { createStyles, useApp } from "../app/providers";
import { ProgressBar } from "../app/ProgressBar";

/**
 * Where this chat's Drive copy stands, in one line — a progress bar while it uploads.
 *
 * `autoStart` (Verify) begins a backup by itself when Drive is connected: right after saving a
 * chat is when a second copy matters most. Explanations live in Settings → Help, not here.
 */
export function DriveBackup({
  archiveId,
  updatedAt,
  autoStart = false,
}: {
  archiveId: string;
  /** `Manifest.updatedAt`, to tell a current backup from one that predates the latest import. */
  updatedAt: number;
  autoStart?: boolean;
}) {
  const { t } = useApp();
  const styles = useStyles();
  const router = useRouter();
  const [connected, setConnected] = useState<boolean | undefined>(undefined);
  const [status, setStatus] = useState<BackupStatus>({ kind: "idle" });
  const [backedUpAt, setBackedUpAt] = useState<number | undefined>(undefined);
  const started = useRef(false);

  useEffect(() => watchBackup(archiveId, setStatus), [archiveId]);
  useEffect(() => {
    void readBackupState(archiveId).then((state) => setBackedUpAt(state.backedUpAt));
  }, [archiveId, status.kind]);

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

  if (!connected) {
    return (
      <View style={styles.row}>
        <Text style={styles.muted}>{t("backup.onlyPhone")}</Text>
        <Pressable onPress={() => router.push("/account")} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>{t("backup.connect")}</Text>
        </Pressable>
      </View>
    );
  }

  if (status.kind === "running") {
    const fraction =
      status.progress !== undefined && status.progress.total > 0
        ? status.progress.done / status.progress.total
        : 0;
    return (
      <View style={styles.stack}>
        <Text style={styles.muted}>
          {t("backup.uploading", { percent: String(Math.round(fraction * 100)) })}
        </Text>
        <ProgressBar fraction={fraction} />
      </View>
    );
  }

  const retry = () => void backupArchive(archiveId);
  if (status.kind === "failed") {
    return (
      <View style={styles.row}>
        <Text style={styles.muted}>{t("backup.failed")}</Text>
        <Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>{t("backup.retry")}</Text>
        </Pressable>
      </View>
    );
  }
  if (status.kind === "diverged") return <Text style={styles.muted}>{t("backup.diverged")}</Text>;

  const current = backedUpAt !== undefined && backedUpAt >= updatedAt;
  return current ? (
    <Text style={styles.good}>✓ {t("backup.inDrive")}</Text>
  ) : (
    <View style={styles.row}>
      <Text style={styles.muted}>{t("backup.onlyPhone")}</Text>
      <Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.link}>{t("backup.now")}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  stack: { gap: space.xs + 2 },
  muted: { fontSize: 14, color: t.muted, writingDirection: "auto", flexShrink: 1 },
  link: { fontSize: 14, fontWeight: "600", color: t.accent },
  good: { fontSize: 14, fontWeight: "600", color: t.good, writingDirection: "auto" },
}));
