import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
                source={{ uri: subject.uri }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel={subject.filename}
              />
            </Pressable>
          </ScrollView>

          <View style={styles.caption}>
            <Text style={styles.captionPrimary} numberOfLines={1}>
              {subject.sender ?? t("common.unknown")} · {formatDateTime(subject.ts)}
            </Text>
            <Text style={styles.captionSecondary} numberOfLines={1}>
              {subject.filename}
              {subject.byteLength !== undefined ? ` · ${formatBytes(subject.byteLength)}` : ""}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.done")}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>{t("common.done")}</Text>
          </Pressable>

          {action !== undefined && (
            <Pressable
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: action.disabled === true }}
              style={({ pressed }) => [
                styles.close,
                styles.action,
                pressed && styles.pressed,
                action.disabled === true && styles.settled,
              ]}
            >
              <Text style={styles.closeLabel}>{action.label}</Text>
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
    paddingBottom: 34,
    gap: 2,
    backgroundColor: "#000000aa",
  },
  captionPrimary: { color: "#fff", fontSize: 14, fontWeight: "600" },
  captionSecondary: { color: "#cfcbc4", fontSize: 12 },
  close: {
    position: "absolute",
    top: 60,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#ffffff22",
  },
  // Done's twin, on the opposite side.
  action: { right: undefined, left: 20 },
  settled: { opacity: 0.55 },
  pressed: { opacity: 0.6 },
  closeLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
