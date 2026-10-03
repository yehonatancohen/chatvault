/**
 * The first-launch tutorial: shown once automatically and reachable afterward from the empty
 * library (`app/(tabs)/index.tsx`).
 *
 * Six pages, and most of them are pictures. It opens and closes the way a system welcome screen
 * does — the app's icon, a large title, one line; then what "safe to delete" looks like — and
 * the four pages between are WhatsApp's own export steps (`StepShot.tsx`), each with the control
 * to tap ringed and one line underneath. A user following along on their own phone matches a
 * picture, not a paragraph.
 *
 * A full-screen `Modal` rather than a route: it has no back-navigable state of its own (nothing
 * here should ever land in history), and unlike `RemoveArchiveSheet` it is not a confirmation —
 * there is no scrim to tap through, only "Skip" and paging.
 *
 * **Motion is one thing:** when a page settles, its picture lifts into place and its number plate
 * lands a beat after. With Reduce Motion on, both simply appear.
 */

import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
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
import { STEP_COUNT, SHOT_ASPECT, StepShot } from "./StepShot";
import { createStyles, useApp } from "./providers";
import { StatusPill } from "../archive/StatusPill";
import { gutter, radius, space, type } from "../../lib/ui/theme";
import type { StringKey } from "../../lib/i18n/strings";
import mark from "../../assets/images/mark.png";

type Page =
  | { kind: "welcome" }
  | { kind: "step"; index: number }
  | { kind: "safe" };

const PAGES: readonly Page[] = [
  { kind: "welcome" },
  ...Array.from({ length: STEP_COUNT }, (_, i): Page => ({ kind: "step", index: i + 1 })),
  { kind: "safe" },
];

/** Fixed insets: this app carries no safe-area library (see `RemoveArchiveSheet`), and a modal
 * covers the notch and the home indicator both. Generous enough for a Dynamic Island. */
const TOP_INSET = 60;
const BOTTOM_INSET = 40;

export function Onboarding({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const reduceMotion = useReduceMotion();

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page && next >= 0 && next < PAGES.length) setPage(next);
  };

  const last = page === PAGES.length - 1;
  const advance = (): void => {
    if (last) {
      onClose();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (page + 1), animated: !reduceMotion });
  };

  // The picture's height is whatever the screen has left after the chrome and one line of text,
  // and its width follows from the picture's own shape — capped so it never runs into the gutters.
  const chrome = TOP_INSET + 44 + 150 + BOTTOM_INSET + 120;
  const shotWidth = Math.min(width - gutter * 2, Math.max(180, (height - chrome) * SHOT_ASPECT));

  return (
    <Modal visible animationType={reduceMotion ? "fade" : "slide"} onRequestClose={onClose}>
      <View style={styles.fill}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.pager}
        >
          {PAGES.map((item, index) => (
            <View
              key={index}
              style={[styles.page, { width }]}
            >
              {item.kind === "welcome" && <Welcome />}
              {item.kind === "step" && (
                <Step
                  index={item.index}
                  width={shotWidth}
                  active={index === page}
                  reduceMotion={reduceMotion}
                />
              )}
              {item.kind === "safe" && <Safe />}
            </View>
          ))}
        </ScrollView>

        <View style={styles.skipRow} pointerEvents="box-none">
          {!last && (
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
              <Text style={styles.skipLabel}>{t("onboarding.skip")}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.ticks} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {PAGES.map((_, index) => (
              <View
                key={index}
                style={[styles.tick, index === page && styles.tickActive]}
              />
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

function Welcome() {
  const { t } = useApp();
  const styles = useStyles();
  return (
    <View style={styles.signPage}>
      <Image source={mark} style={styles.mark} accessibilityIgnoresInvertColors />
      <View style={styles.signText}>
        <Text style={styles.signTitle} accessibilityRole="header">
          {t("onboarding.slide1.title")}
        </Text>
        <Text style={styles.signBody}>{t("onboarding.slide1.body")}</Text>
      </View>
    </View>
  );
}

function Step({
  index,
  width,
  active,
  reduceMotion,
}: {
  index: number;
  width: number;
  active: boolean;
  reduceMotion: boolean;
}) {
  const { t } = useApp();
  const styles = useStyles();
  const text = t(`onboarding.step.${index}` as StringKey);
  const lift = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const stamp = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!active) return;
    if (reduceMotion) {
      lift.setValue(1);
      stamp.setValue(1);
      return;
    }
    lift.setValue(0);
    stamp.setValue(0);
    Animated.sequence([
      Animated.timing(lift, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.spring(stamp, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
    ]).start();
  }, [active, reduceMotion, lift, stamp]);

  return (
    <View style={styles.stepPage}>
      <Animated.View
        style={{
          opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        }}
      >
        <StepShot index={index} width={width} label={text} />
      </Animated.View>
      <View style={styles.stepCaption}>
        <Animated.View
          style={[
            styles.plate,
            { transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        >
          <Text style={styles.plateNumber}>{index}</Text>
        </Animated.View>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

/** The last page shows the status a user is waiting for, drawn by the real `StatusPill`. */
function Safe() {
  const { t } = useApp();
  const styles = useStyles();
  const chat = t("onboarding.sample.chat");
  return (
    <View style={styles.signPage}>
      <View style={styles.specimen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.specimenAvatar}>
          <Text style={styles.specimenInitial}>{chat.slice(0, 1)}</Text>
        </View>
        <Text style={styles.specimenTitle} numberOfLines={1}>
          {chat}
        </Text>
        <StatusPill status={{ kind: "safe" }} />
      </View>
      <View style={styles.signText}>
        <Text style={styles.signTitle} accessibilityRole="header">
          {t("onboarding.slide3.title")}
        </Text>
        <Text style={styles.signBody}>{t("onboarding.slide3.body")}</Text>
      </View>
    </View>
  );
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

const useStyles = createStyles((t) => ({
  fill: { flex: 1, backgroundColor: t.paper },
  pager: { flex: 1 },
  page: {
    flex: 1,
    paddingTop: TOP_INSET + 44,
    paddingBottom: BOTTOM_INSET + 120,
    paddingHorizontal: space.xl,
  },

  skipRow: {
    position: "absolute",
    top: TOP_INSET,
    start: 0,
    end: 0,
    height: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: gutter,
  },
  skipLabel: { ...type.label, color: t.accent, writingDirection: "auto" },

  // Centred, as a system welcome screen is: the icon, a large title, one line of body.
  signPage: { flex: 1, justifyContent: "center", alignItems: "center", gap: space.xxl },
  // An app icon's own proportions: the corner is 22.37% of the side.
  mark: { width: 112, height: 112, borderRadius: 25, borderCurve: "continuous" },
  signText: { gap: space.md, alignItems: "center" },
  signTitle: { ...type.display, color: t.ink, textAlign: "center", writingDirection: "auto" },
  signBody: { ...type.body, color: t.muted, maxWidth: 340, textAlign: "center", writingDirection: "auto" },

  stepPage: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.xl },
  stepCaption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    alignSelf: "stretch",
  },
  // The same tint disc `Step` uses (`ui.tsx`), a size up for a page that is one step.
  plate: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  plateNumber: { ...type.heading, color: t.onAccent, fontVariant: ["tabular-nums"] },
  // "left" is the start edge: React Native swaps left and right under an RTL layout, while the
  // default natural alignment left these Hebrew blocks flush left.
  stepText: { flex: 1, ...type.heading, fontSize: 20, lineHeight: 25, color: t.ink, paddingTop: 3, textAlign: "left", writingDirection: "auto" },

  // One row of the chat list, as a cell on the grouped page.
  specimen: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderCurve: "continuous",
    backgroundColor: t.panel,
  },
  specimenAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  specimenInitial: { ...type.heading, color: "#ffffff" },
  specimenTitle: { flex: 1, ...type.heading, color: t.ink, writingDirection: "auto" },

  footer: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    paddingHorizontal: space.xl,
    paddingBottom: BOTTOM_INSET,
    gap: space.xl,
  },
  // The system's page control: dots, the current one in primary.
  ticks: { flexDirection: "row", justifyContent: "center", gap: space.sm },
  tick: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.highlight },
  tickActive: { backgroundColor: t.ink },
  next: {
    minHeight: 50,
    borderRadius: radius.button,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
  nextLabel: { ...type.label, fontWeight: "600", color: t.onAccent, writingDirection: "auto" },
}));
