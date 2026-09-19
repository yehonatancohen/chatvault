import { View, useWindowDimensions } from "react-native";
import { STEP_COUNT, StepShot } from "../components/app/StepShot";
import { createStyles, useApp } from "../components/app/providers";
import { Screen, Step } from "../components/app/ui";
import type { StringKey } from "../lib/i18n/strings";
import { gutter, space } from "../lib/ui/theme";

/**
 * How to add a chat: WhatsApp's four export steps, each one line over its picture, and nothing
 * else. Limits, merging and privacy are explained in Settings → Help.
 *
 * The same pictures and the same lines as the tutorial (`Onboarding.tsx`), so a user who half
 * remembers the tutorial recognises every step here. A modal sheet rather than its own tab — it is
 * something you glance at while WhatsApp is open, not a place you navigate to. Reachable from the
 * chat list's header button and from Help.
 */
export default function AddChatScreen() {
  const { t } = useApp();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  // Big enough to read the ringed button, small enough that the next step peeks into view.
  const shotWidth = Math.min(300, (width - gutter * 2) * 0.78);

  return (
    <Screen gap={space.xxl}>
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const text = t(`onboarding.step.${i + 1}` as StringKey);
        return (
          <View key={i} style={styles.step}>
            <Step index={i + 1} text={text} />
            <View style={styles.shot}>
              <StepShot index={i + 1} width={shotWidth} label={text} />
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  step: { gap: space.lg },
  shot: { alignItems: "center" },
}));
