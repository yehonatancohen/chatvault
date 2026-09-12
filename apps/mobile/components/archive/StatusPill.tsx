import { Text, View } from "react-native";
import type { ChatStatus } from "../../lib/ui/chat-status";
import { radius, space, type } from "../../lib/ui/theme";
import { createStyles, useApp } from "../app/providers";
import { ProgressBar } from "../app/ProgressBar";

/** The chat's status in a word or two — plus a thin bar while it uploads. */
export function StatusPill({ status }: { status: ChatStatus }) {
  const { t } = useApp();
  const styles = useStyles();

  if (status.kind === "uploading") {
    return (
      <View style={styles.uploading}>
        <Text style={styles.muted}>
          {t("status.uploading", { percent: String(Math.round(status.fraction * 100)) })}
        </Text>
        <ProgressBar fraction={status.fraction} height={4} />
      </View>
    );
  }

  const label =
    status.kind === "safe"
      ? t("status.safe")
      : status.kind === "deleted"
        ? t("status.deleted")
        : t("status.device");
  // Only "safe to delete" is coloured. The other two are ordinary states of an ordinary chat,
  // and a list where every row wears a tinted badge tells the eye nothing.
  return (
    <View style={[styles.pill, status.kind === "safe" && styles.pillSafe]}>
      <Text style={[styles.label, status.kind === "safe" && styles.labelSafe]}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  uploading: { gap: space.xs, alignSelf: "stretch" },
  muted: { ...type.micro, fontWeight: "400", color: t.muted, writingDirection: "auto" },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: t.sunken,
  },
  pillSafe: { backgroundColor: t.goodWash },
  label: { ...type.micro, color: t.muted, writingDirection: "auto" },
  labelSafe: { color: t.good },
}));
