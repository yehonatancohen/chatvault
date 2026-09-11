import { Text, View } from "react-native";
import type { ChatStatus } from "../../lib/ui/chat-status";
import { space } from "../../lib/ui/theme";
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
  return (
    <View style={[styles.pill, status.kind === "safe" && styles.pillSafe]}>
      <Text style={[styles.label, status.kind === "safe" && styles.labelSafe]}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  uploading: { gap: 4, alignSelf: "stretch" },
  muted: { fontSize: 12, color: t.muted, writingDirection: "auto" },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: t.hairline,
  },
  pillSafe: { backgroundColor: t.goodWash },
  label: { fontSize: 12, fontWeight: "600", color: t.body, writingDirection: "auto" },
  labelSafe: { color: t.good },
}));
