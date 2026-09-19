/**
 * The four WhatsApp export steps as pictures, shared by the tutorial (`Onboarding.tsx`) and the
 * add-chat sheet (`app/add-chat.tsx`).
 *
 * **These are drawn recreations, not screenshots taken from WhatsApp.** They are rendered from
 * `design/tutorial/screens.html` (see the comment at its top): invented names and messages, no
 * WhatsApp logo, and a sun-yellow ring with a numbered plate on the exact control to tap. Hebrew
 * and English each get their own set, because the words on the button are the thing a user is
 * matching against their own screen. Re-render them when WhatsApp moves a button.
 */

import { Image, View, type ImageSourcePropType } from "react-native";
import { createStyles, useApp } from "./providers";
import { radius } from "../../lib/ui/theme";
import step1he from "../../assets/tutorial/step1-he.png";
import step2he from "../../assets/tutorial/step2-he.png";
import step3he from "../../assets/tutorial/step3-he.png";
import step4he from "../../assets/tutorial/step4-he.png";
import step1en from "../../assets/tutorial/step1-en.png";
import step2en from "../../assets/tutorial/step2-en.png";
import step3en from "../../assets/tutorial/step3-en.png";
import step4en from "../../assets/tutorial/step4-en.png";

export const STEP_COUNT = 4;

/** Width over height of every picture (390 × 520 points, rendered at 3×). */
export const SHOT_ASPECT = 390 / 520;

const SHOTS: Record<"he" | "en", readonly ImageSourcePropType[]> = {
  he: [step1he, step2he, step3he, step4he],
  en: [step1en, step2en, step3en, step4en],
};

/** Step `index` (1-based), framed like a phone screen, at `width` points wide. */
export function StepShot({
  index,
  width,
  label,
}: {
  index: number;
  width: number;
  /** What the step says — the picture's accessibility label, so VoiceOver reads the step. */
  label: string;
}) {
  const { language } = useApp();
  const styles = useStyles();
  const source = SHOTS[language === "he" ? "he" : "en"][index - 1];
  return (
    <View style={[styles.frame, { width, height: width / SHOT_ASPECT }]}>
      <Image
        source={source}
        style={styles.image}
        resizeMode="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
      />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  // A thick ink rim rather than a drawn device: the picture is a crop of a screen, and a bezel
  // around a crop would pretend it is the whole phone.
  frame: {
    borderRadius: radius.sheet,
    borderWidth: 3,
    borderColor: t.dark ? t.raised : t.ink,
    overflow: "hidden",
    backgroundColor: t.panel,
  },
  image: { width: "100%", height: "100%" },
}));
