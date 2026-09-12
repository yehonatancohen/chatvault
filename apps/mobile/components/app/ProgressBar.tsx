import { View } from "react-native";
import { createStyles } from "./providers";

/** A thin determinate bar. `fraction` is clamped to 0–1. */
export function ProgressBar({ fraction, height = 6 }: { fraction: number; height?: number }) {
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[styles.fill, { width: `${clamped * 100}%`, borderRadius: height / 2 }]} />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  track: { width: "100%", overflow: "hidden", backgroundColor: t.sunken },
  fill: { height: "100%", backgroundColor: t.accent },
}));
