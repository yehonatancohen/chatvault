import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
 */

export interface LightboxSubject {
  readonly uri: string;
  readonly filename: string;
  readonly sender: string | null;
  readonly ts: number;
  readonly byteLength?: number;
}

export function Lightbox({
  subject,
  onClose,
}: {
  subject: LightboxSubject | undefined;
  onClose: () => void;
}) {
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
              {subject.sender ?? "Unknown"} · {formatDateTime(subject.ts)}
            </Text>
            <Text style={styles.captionSecondary} numberOfLines={1}>
              {subject.filename}
              {subject.byteLength !== undefined ? ` · ${formatBytes(subject.byteLength)}` : ""}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>Done</Text>
          </Pressable>
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
  pressed: { opacity: 0.6 },
  closeLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
