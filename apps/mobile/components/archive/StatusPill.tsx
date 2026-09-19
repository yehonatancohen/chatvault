import { Text, View } from "react-native";
import type { ChatStatus } from "../../lib/ui/chat-status";
import { radius, space, type } from "../../lib/ui/theme";
import { Icon } from "../app/Icon";
import { createStyles, useApp } from "../app/providers";
import { ProgressBar } from "../app/ProgressBar";

/**
 * The chat's status as a small sign plate — plus a bar while it uploads.
 *
 * Only "safe to delete" is a coloured plate: sun yellow with ink type, the one thing in the list
 * worth looking at. "On this phone" is a quiet grey plate, and "deleted" drops the plate
 * altogether — it is a finished state, a checkmark and a word. A list where every row wears a
 * bright badge tells the eye nothing.
 *
 * The chat list stands these in one column at the rows' trailing edge, so a user reads what to
 * do by sweeping down that column rather than hunting through each row.
 */
export function StatusPill({ status }: { status: ChatStatus }) {
  const { t, theme } = useApp();
  const styles = useStyles();

  if (status.kind === "uploading") {
    return (
      <View style={styles.uploading}>
        <Text style={styles.uploadingLabel} numberOfLines={1}>
          {t("status.uploading", { percent: String(Math.round(status.fraction * 100)) })}
        </Text>
        <ProgressBar fraction={status.fraction} height={4} />
      </View>
    );
  }

  if (status.kind === "deleted") {
    return (
      <View style={styles.done}>
        <Icon name="check" color={theme.faint} size={13} weight="bold" />
        <Text style={styles.doneLabel} numberOfLines={1}>
          {t("status.deleted")}
        </Text>
      </View>
    );
  }

  const safe = status.kind === "safe";
  return (
    <View style={[styles.plate, safe && styles.plateSafe]}>
      <Text style={[styles.label, safe && styles.labelSafe]} numberOfLines={1}>
        {safe ? t("status.safe") : t("status.device")}
      </Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  uploading: { gap: space.xs, alignSelf: "stretch", alignItems: "flex-end" },
  uploadingLabel: { ...type.micro, color: t.accent, writingDirection: "auto" },
  plate: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.plate,
    backgroundColor: t.sunken,
  },
  plateSafe: { backgroundColor: t.sun },
  label: { ...type.micro, color: t.muted, writingDirection: "auto" },
  labelSafe: { fontWeight: "700", color: t.onSun },
  done: { flexDirection: "row", alignItems: "center", gap: 3 },
  doneLabel: { ...type.micro, color: t.faint, writingDirection: "auto" },
}));
