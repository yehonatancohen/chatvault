import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { radius, theme } from "../lib/ui/theme";

/**
 * A6 — guided delete.
 *
 * **This screen deletes nothing, and must never appear to.** There is no API for deleting a
 * WhatsApp chat and there never will be one; root CLAUDE.md invariant 1 says any UI string
 * claiming we free storage directly is a bug. So this is instructions and a confirmation the
 * user gives *us*, describing something they did themselves in another app.
 *
 * The tone is deliberately unhurried. Everything from here is irreversible and performed by the
 * user's own hands, and the honest framing is "here is how, when you are ready" — never a
 * celebration or a nudge. The one piece of pressure the screen does apply is in the other
 * direction: a last reminder to go back and check the numbers.
 */

export default function DeleteGuideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string }>();
  const [confirmed, setConfirmed] = useState(false);

  const chat = params.title ?? "the chat";
  const steps = Platform.OS === "ios" ? IOS_STEPS : ANDROID_STEPS;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Deleting {chat} in WhatsApp</Text>

      <Text style={styles.body}>
        Your archive is written and encrypted on this phone. Deleting the chat is something only
        you can do — ChatVault has no way to reach into WhatsApp, and neither does any other
        app.
      </Text>

      <View style={styles.checkFirst}>
        <Text style={styles.checkFirstTitle}>Before you do</Text>
        <Text style={styles.checkFirstBody}>
          Go back one screen and read the numbers again. Once the chat is gone, anything the
          archive did not capture is gone with it.
        </Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}
        >
          <Text style={styles.inlineButtonLabel}>Back to what was captured</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>In WhatsApp, on {Platform.OS === "ios" ? "iPhone" : "Android"}</Text>
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>What "Clear chat" does instead</Text>
        <Text style={styles.noteBody}>
          Clearing empties the messages but keeps the chat in your list. Deleting removes both.
          Either one frees the space the media was using; neither can be undone from inside
          WhatsApp.
        </Text>
      </View>

      <Pressable
        onPress={() => setConfirmed((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        style={({ pressed }) => [styles.confirmRow, pressed && styles.pressed]}
      >
        <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
          {confirmed && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.confirmLabel}>I have deleted this chat in WhatsApp</Text>
      </Pressable>

      {confirmed && (
        <Text style={styles.confirmedNote}>
          Noted on this phone only — we have no way to check, and we do not try. Your archive
          stays exactly as it is.
        </Text>
      )}

      <Pressable
        onPress={() => router.replace("/")}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const IOS_STEPS = [
  "Open WhatsApp and find the chat in your Chats list.",
  "Swipe left on it, then tap More.",
  "Tap Delete Chat, and confirm.",
  "To reclaim the space now: Settings → Storage and Data → Manage Storage.",
] as const;

const ANDROID_STEPS = [
  "Open WhatsApp and find the chat in your Chats list.",
  "Press and hold the chat until it is selected.",
  "Tap the bin icon at the top, and confirm.",
  "To reclaim the space now: Settings → Storage and data → Manage storage.",
] as const;

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48, gap: 14 },
  heading: { fontSize: 24, fontWeight: "600", color: theme.ink, letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 23, color: theme.body },
  sectionTitle: { marginTop: 12, fontSize: 13, fontWeight: "600", color: theme.muted },
  checkFirst: {
    marginTop: 4,
    padding: 16,
    gap: 10,
    borderRadius: radius.card,
    backgroundColor: theme.panel,
    borderLeftWidth: 3,
    borderLeftColor: theme.caution,
  },
  checkFirstTitle: { fontSize: 15, fontWeight: "600", color: theme.ink },
  checkFirstBody: { fontSize: 14, lineHeight: 21, color: theme.body },
  inlineButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: theme.hairline,
    backgroundColor: theme.paper,
  },
  inlineButtonLabel: { fontSize: 14, fontWeight: "600", color: theme.ink },
  steps: { gap: 14, paddingVertical: 4 },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.ink,
    color: theme.paper,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 13,
    fontWeight: "700",
    overflow: "hidden",
  },
  stepText: { flex: 1, fontSize: 15, lineHeight: 23, color: theme.body },
  note: {
    marginTop: 8,
    padding: 16,
    gap: 6,
    borderRadius: radius.card,
    backgroundColor: theme.panel,
  },
  noteTitle: { fontSize: 14, fontWeight: "600", color: theme.ink },
  noteBody: { fontSize: 14, lineHeight: 21, color: theme.body },
  confirmRow: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.hairline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.paper,
  },
  checkboxChecked: { backgroundColor: theme.good, borderColor: theme.good },
  checkboxMark: { color: theme.paper, fontSize: 15, fontWeight: "700" },
  confirmLabel: { flex: 1, fontSize: 15, lineHeight: 22, color: theme.ink },
  confirmedNote: { fontSize: 13, lineHeight: 20, color: theme.muted },
  button: {
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: radius.card,
    alignItems: "center",
    backgroundColor: theme.ink,
  },
  pressed: { opacity: 0.7 },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: theme.paper },
});
