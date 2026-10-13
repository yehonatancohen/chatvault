import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "../app/Glass";
import { useApp } from "../app/providers";
import { formatBytes, formatDateTime } from "../../lib/ui/format";

/**
 * Full-screen view of one archived photo.
 *
 * Mirrors `apps/web/app/open/Lightbox.tsx` in role: tap a photo, see it properly. It takes the
 * already-decrypted `uri` from the row that rendered the thumbnail rather than decrypting
 * again — the bytes are in memory either way, and decrypting twice for the same photo would
 * double the cost of the only interaction anyone performs repeatedly in the reader.
 *
 * `ScrollView` with `maximumZoomScale` is doing the zooming. A gesture library would be nicer
 * and would be a dependency; this is the platform's own pinch-to-zoom and it costs nothing.
 *
 * **The only screen that ignores the theme, deliberately.** A photo is judged against black
 * whatever the rest of the app is doing, and every system photo viewer agrees; a "light mode"
 * lightbox would tint the one thing on screen the user is trying to see accurately.
 */

export interface LightboxSubject {
  readonly uri: string;
  readonly filename: string;
  readonly sender: string | null;
  readonly ts: number;
  readonly byteLength?: number;
  /** Content address of the photo, when the caller wants to act on it (e.g. set a chat photo). */
  readonly sha256?: string;
  /**
   * When `uri` is only the small preview: loads the full photo, which replaces it once it
   * arrives (from the phone, or from Drive for a photo the phone no longer keeps).
   */
  readonly resolveFull?: () => Promise<string>;
}

/** One optional button beside Done. `disabled` shows it as a settled state, e.g. "Chat photo ✓". */
export interface LightboxAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export function Lightbox({
  subject,
  onClose,
  action,
}: {
  subject: LightboxSubject | undefined;
  onClose: () => void;
  action?: LightboxAction | undefined;
}) {
  const { t } = useApp();
  // The controls used to sit at a fixed 60pt from the top and 34pt from the bottom — right for
  // one iPhone, under the Dynamic Island on another, and floating mid-screen on a phone with a
  // home button.
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 20) + 8;
  const [fullUri, setFullUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    setFullUri(undefined);
    if (subject?.resolveFull === undefined) return;
    let stale = false;
    subject
      .resolveFull()
      .then((uri) => {
        if (!stale) setFullUri(uri);
      })
      .catch(() => {
        // Offline, or Drive unreachable: the preview stays up, which is still the photo.
      });
    return () => {
      stale = true;
    };
  }, [subject]);

  const loadingFull = subject?.resolveFull !== undefined && fullUri === undefined;

  return (
    <Modal
      visible={subject !== undefined}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // Android's back button and the iOS swipe both land on `onRequestClose`; without it the
      // only way out would be the button, which is exactly the kind of trap a full-screen
      // image view should never be.
      statusBarTranslucent
    >
      {subject !== undefined && (
        <View style={styles.backdrop}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
          >
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.imagePress}>
              <Image
                source={{ uri: fullUri ?? subject.uri }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel={subject.filename}
              />
            </Pressable>
          </ScrollView>

          {loadingFull && <ActivityIndicator color="#fff" style={[styles.loadingFull, { top: top + 8 }]} />}

          <View style={[styles.caption, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
            <Text style={styles.captionPrimary} numberOfLines={1}>
              {subject.sender ?? t("common.unknown")} · {formatDateTime(subject.ts)}
            </Text>
            <Text style={styles.captionSecondary} numberOfLines={1}>
              {subject.filename}
              {subject.byteLength !== undefined ? ` · ${formatBytes(subject.byteLength)}` : ""}
            </Text>
          </View>

          {/* Floating controls over a photo: the case Liquid Glass was drawn for. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.done")}
            hitSlop={8}
            style={[styles.control, styles.controlEnd, { top }]}
          >
            <Glass style={styles.controlShape} fallbackStyle={styles.controlFallback} interactive>
              <Text style={styles.closeLabel}>{t("common.done")}</Text>
            </Glass>
          </Pressable>

          {action !== undefined && (
            <Pressable
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: action.disabled === true }}
              hitSlop={8}
              style={[styles.control, styles.controlStart, { top }]}
            >
              <Glass style={styles.controlShape} fallbackStyle={styles.controlFallback} interactive>
                <Text style={[styles.closeLabel, action.disabled === true && styles.settled]}>{action.label}</Text>
              </Glass>
            </Pressable>
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000000ee" },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  imagePress: { width: "100%", height: "100%", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 2,
    backgroundColor: "#000000aa",
  },
  captionPrimary: { color: "#fff", fontSize: 15, fontWeight: "600" },
  captionSecondary: { color: "rgba(235, 235, 245, 0.6)", fontSize: 13 },
  control: { position: "absolute" },
  controlEnd: { end: 16 },
  controlStart: { start: 16 },
  controlShape: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  controlFallback: { backgroundColor: "#ffffff2e" },
  settled: { opacity: 0.55 },
  loadingFull: { position: "absolute", alignSelf: "center" },
  closeLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
