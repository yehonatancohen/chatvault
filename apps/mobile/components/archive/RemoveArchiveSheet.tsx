/**
 * Removing an archive from this phone.
 *
 * This is the only destructive action in a product whose entire pitch is that things stop being
 * lost, so the confirmation is scaled to what is actually at risk rather than being one modal
 * for every case:
 *
 * - **A broken archive** cannot be opened, so there is nothing in it to lose. One tap.
 * - **A locked archive** may be perfectly good — the key is simply not in this Keychain — so the
 *   copy points at unlocking first, but it does not gate the removal: a user who no longer has
 *   the passphrase must still be able to clear it, and refusing would leave them stuck with a
 *   row they cannot act on. That is exactly the state the two archives that prompted this were in.
 * - **A readable archive** is someone's only copy of a conversation, quite possibly one they
 *   have already deleted in WhatsApp on the strength of this app's promise. It is gated behind
 *   an explicit acknowledgement, and the counts are spelled out so the sentence being agreed to
 *   contains the actual quantity at stake.
 *
 * **Deliberately not `Alert.alert`.** A native alert is a modal dialog, and the browser-dialog
 * rule aside, it cannot hold a checkbox or the counts — which are the two things that make this
 * confirmation mean anything. It is also unstyleable, so it would be the one surface in the app
 * that ignores the dark theme.
 *
 * **Deliberately not a hold-to-confirm progress button**, which was the other candidate: firing
 * an irreversible delete from an animation's completion callback makes data loss contingent on
 * frame timing, and this is not the place to be clever.
 */

import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { useApp, createStyles } from "../app/providers";
import { Button, CheckRow } from "../app/ui";
import { deleteArchive } from "../../lib/archive/vault";
import type { LibraryEntry } from "../../lib/archive/library";
import { radius, space, type } from "../../lib/ui/theme";

export function RemoveArchiveSheet({
  entry,
  onClose,
  onRemoved,
}: {
  /** The archive to remove, or `undefined` when the sheet is closed. */
  entry: LibraryEntry | undefined;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { t, tp } = useApp();
  const styles = useStyles();

  const [acknowledged, setAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  // A fresh subject is a fresh decision: carrying a ticked box from the last archive to this one
  // would mean a second removal needed one tap where the first needed two.
  useEffect(() => {
    setAcknowledged(false);
    setFailure(undefined);
    setWorking(false);
  }, [entry?.archiveId]);

  if (entry === undefined) return null;

  const ready = entry.status === "ready";
  const body =
    entry.status === "unreadable"
      ? t("remove.broken.body")
      : entry.status === "locked"
        ? t("remove.locked.body")
        : t("remove.ready.body", {
            messages: tp("common.messages", entry.manifest?.messageCount ?? 0),
            files: tp("common.files", entry.manifest?.media.length ?? 0),
          });

  const canRemove = !working && (!ready || acknowledged);

  const remove = async (): Promise<void> => {
    setWorking(true);
    setFailure(undefined);
    try {
      await deleteArchive(entry.archiveId);
      onRemoved();
    } catch (error) {
      // Shown rather than swallowed: a removal that silently did nothing leaves a row the user
      // will keep tapping, and the message names the reason.
      setFailure(error instanceof Error ? error.message : String(error));
      setWorking(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={working ? () => undefined : onClose}
    >
      {/* Tapping the scrim cancels — but never mid-removal, when there is nothing to cancel. */}
      <Pressable style={styles.scrim} onPress={working ? undefined : onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.grabber} />

          <Text style={styles.title}>{t("remove.title")}</Text>
          {entry.status === "ready" && entry.manifest !== undefined && (
            <Text style={styles.chat} numberOfLines={2}>
              {entry.manifest.chatTitle}
            </Text>
          )}

          <Text style={styles.body}>{body}</Text>
          <Text style={styles.note}>{t("remove.noteWhatsApp")}</Text>

          {ready && (
            <CheckRow
              label={t("remove.ready.confirm")}
              checked={acknowledged}
              onToggle={() => setAcknowledged((value) => !value)}
            />
          )}

          {failure !== undefined && (
            <Text style={styles.failure} selectable>
              {t("remove.failed", { error: failure })}
            </Text>
          )}

          {working ? (
            <View style={styles.working}>
              <ActivityIndicator />
              <Text style={styles.workingLabel}>{t("remove.working")}</Text>
            </View>
          ) : (
            <View style={styles.buttons}>
              <Button
                label={t("remove.cta")}
                tone="danger"
                onPress={() => void remove()}
                disabled={!canRemove}
              />
              <Button label={t("common.cancel")} tone="quiet" onPress={onClose} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((t) => ({
  scrim: { flex: 1, backgroundColor: t.scrim, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: t.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.xl,
    paddingBottom: space.xxxl,
    gap: space.md,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.hairline,
    marginBottom: space.sm,
  },
  title: { ...type.title, color: t.ink, writingDirection: "auto" },
  chat: { ...type.label, color: t.accent, writingDirection: "auto" },
  body: { ...type.body, color: t.body, writingDirection: "auto" },
  note: { ...type.caption, color: t.muted, writingDirection: "auto" },
  failure: {
    ...type.caption,
    color: t.bad,
    backgroundColor: t.badWash,
    padding: space.md,
    borderRadius: radius.chip,
    writingDirection: "auto",
  },
  working: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.lg,
  },
  workingLabel: { ...type.body, color: t.body, writingDirection: "auto" },
  buttons: { gap: space.md, paddingTop: space.sm },
}));
