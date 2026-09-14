/**
 * The first-launch tutorial: three slides, shown once automatically and reachable afterward from
 * the empty library (`app/(tabs)/index.tsx`).
 *
 * A full-screen `Modal` rather than a route: it has no back-navigable state of its own (nothing
 * here should ever land in history), and unlike `RemoveArchiveSheet` it is not a confirmation —
 * there is no scrim to tap through, only "Skip" and paging.
 *
 * Each slide's illustration is its own small component (`WelcomeArt`, `AddStepsArt`, `SafeArt`)
 * so that dropping in a real screenshot later is a one-line swap inside that function, not a
 * layout change.
 */

import { useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { StepArt } from "./StepArt";
import { createStyles, useApp } from "./providers";
import { radius, space, type } from "../../lib/ui/theme";
import type { StringKey } from "../../lib/i18n/strings";
import appMark from "../../assets/images/icon.png";

const SLIDES = [
  { title: "onboarding.slide1.title", body: "onboarding.slide1.body", art: "welcome" },
  { title: "onboarding.slide2.title", body: "onboarding.slide2.body", art: "add" },
  { title: "onboarding.slide3.title", body: "onboarding.slide3.body", art: "safe" },
] as const satisfies readonly { title: StringKey; body: StringKey; art: "welcome" | "add" | "safe" }[];

export function Onboarding({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const last = page === SLIDES.length - 1;
  const advance = (): void => {
    if (last) {
      onClose();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <View style={styles.skipRow}>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.skipLabel}>{t("onboarding.skip")}</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((slide) => (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <Art name={slide.art} />
              <Text style={styles.title}>{t(slide.title)}</Text>
              <Text style={styles.body}>{t(slide.body)}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((slide, index) => (
              <View key={slide.title} style={[styles.dot, index === page && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            onPress={advance}
            accessibilityRole="button"
            style={({ pressed }) => [styles.next, pressed && styles.pressed]}
          >
            <Text style={styles.nextLabel}>{last ? t("common.done") : t("onboarding.next")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Art({ name }: { name: "welcome" | "add" | "safe" }) {
  if (name === "welcome") return <WelcomeArt />;
  if (name === "add") return <AddStepsArt />;
  return <SafeArt />;
}

/** The app's own mark — the same wood-cupboard icon the app ships as its launcher icon. */
function WelcomeArt() {
  const styles = useStyles();
  return <Image source={appMark} style={styles.mark} accessibilityLabel="" />;
}

/** The export → attach → pick sequence, as a row of the same icons the add-chat sheet uses. */
function AddStepsArt() {
  const styles = useStyles();
  const theme = useApp().theme;
  return (
    <View style={styles.stepsRow}>
      <StepArt name="export" color={theme.accent} />
      <View style={styles.stepsArrow} />
      <StepArt name="media" color={theme.accent} />
      <View style={styles.stepsArrow} />
      <StepArt name="pick" color={theme.accent} />
    </View>
  );
}

/** A checkmark inside a shield-like rounded square, in `good` — the one screen that colours it. */
function SafeArt() {
  const styles = useStyles();
  const theme = useApp().theme;
  return (
    <View style={[styles.shield, { borderColor: theme.good }]}>
      <View
        style={{
          width: 20,
          height: 11,
          borderLeftWidth: 3,
          borderBottomWidth: 3,
          borderColor: theme.good,
          transform: [{ rotate: "-45deg" }],
          marginTop: -4,
        }}
      />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  fill: { flex: 1, backgroundColor: t.paper },
  skipRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: space.xl,
    // No safe-area library in this app (nothing else needs one — every other screen sits under
    // a native header that already accounts for the notch). Generous fixed padding here, same
    // approximation `RemoveArchiveSheet` uses for its own bottom inset.
    paddingTop: space.xxxl,
  },
  skipLabel: { ...type.label, color: t.muted, writingDirection: "auto", padding: space.sm },
  scroll: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xxl,
    paddingTop: space.xxxl,
    gap: space.xl,
  },
  mark: { width: 112, height: 112, borderRadius: radius.card },
  stepsRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepsArrow: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: t.hairline,
  },
  shield: {
    width: 88,
    height: 88,
    borderRadius: radius.card,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.title, color: t.ink, textAlign: "center", writingDirection: "auto" },
  body: {
    ...type.body,
    color: t.muted,
    textAlign: "center",
    maxWidth: 320,
    writingDirection: "auto",
  },
  footer: {
    paddingHorizontal: space.xxl,
    paddingBottom: space.xxxl,
    paddingTop: space.md,
    gap: space.xl,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.hairline },
  dotActive: { backgroundColor: t.accent },
  next: {
    minHeight: 52,
    borderRadius: radius.button,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  nextLabel: { ...type.label, fontWeight: "600", color: t.onAccent, writingDirection: "auto" },
}));
