import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { readPreferences } from "../../lib/archive/preferences";
import { readBackupState } from "../../lib/drive/backup-state";
import { watchBackup, type BackupStatus } from "../../lib/drive/device-sync";
import { chatStatus, progressFraction, type ChatStatus } from "../../lib/ui/chat-status";

/**
 * One chat's status, live: backup progress as it happens, the last completed backup from disk,
 * and whether the user has told us they deleted the chat in WhatsApp. See `lib/ui/chat-status.ts`.
 */
export function useChatStatus(archiveId: string, updatedAt: number): ChatStatus {
  const [backup, setBackup] = useState<BackupStatus>({ kind: "idle" });
  const [backedUpAt, setBackedUpAt] = useState<number | undefined>(undefined);
  const [deletedAt, setDeletedAt] = useState<number | undefined>(undefined);

  useEffect(() => watchBackup(archiveId, setBackup), [archiveId]);

  const refresh = useCallback(() => {
    void readBackupState(archiveId).then((state) => setBackedUpAt(state.backedUpAt));
    void readPreferences(archiveId).then((prefs) => setDeletedAt(prefs.deletedInWhatsAppAt));
  }, [archiveId]);

  // On focus: the delete guide sets "deleted" on another screen.
  useFocusEffect(refresh);
  // And whenever a backup finishes, so the pill turns green without leaving the screen.
  useEffect(() => {
    if (backup.kind === "done") setBackedUpAt(backup.backedUpAt);
  }, [backup]);

  return chatStatus({
    updatedAt,
    backedUpAt,
    deletedAt,
    uploading: backup.kind === "running" ? { fraction: progressFraction(backup.progress) } : undefined,
  });
}
