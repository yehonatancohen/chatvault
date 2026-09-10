import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { takeImportSession, type ImportSession } from "../lib/import/session";
import { formatBytes, formatCount, formatRange } from "../lib/ui/format";
import { explainMedia } from "../lib/ui/media-explanation";
import { summarizeParticipants } from "../lib/ui/participants";
import { radius, theme } from "../lib/ui/theme";

/**
 * A5 — Verify. The trust moment, and the screen this whole product is really about.
 *
 * Everything downstream of here is irreversible and done by the user's own hands in WhatsApp.
 * So this screen has exactly one job: be believed, by being true. Three rules follow, and each
 * of them is a rule because the opposite is tempting.
 *
 * 1. **`notArchivedCount` is shown as prominently as the good news.** It is the media that
 *    disappears when they delete the chat — messages WhatsApp itself omitted from the export,
 *    plus files the export named but did not contain. `mediaStats`'s own doc comment says it
 *    "must never be rounded away, softened, or omitted from the UI". A product that hides it
 *    would work better in a demo and betray the user exactly once, permanently.
 * 2. **The numbers were read back out of the archive**, not remembered from the write
 *    (`run-import.ts`). What this screen reports is what came out of the file.
 * 3. **Nothing here claims to free storage or to have deleted anything.** Invariant 1. The
 *    next screen guides; it does not act.
 *
 * A user who does not believe this screen will never delete a chat, and the product's entire
 * value depends on them doing so — but the answer to that is a screen that earns it, never one
 * that overstates.
 */

export default function VerifyScreen() {
  const router = useRouter();
  const [session, setSession] = useState<ImportSession | undefined>(undefined);
  const [showEveryone, setShowEveryone] = useState(false);

  useEffect(() => {
    // Read once, on mount. A cold start onto this route has no session — see the fallback.
    setSession(takeImportSession());
  }, []);

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Nothing to verify</Text>
        <Text style={styles.body}>
          This screen shows what an import captured, right after it happens. Open an archive
          from the library to see what it holds now.
        </Text>
        <Button label="Back to library" onPress={() => router.replace("/")} />
      </ScrollView>
    );
  }

  const { outcome } = session;
  const { stats } = outcome;
  const media = explainMedia(stats, session.hadMedia);
  const people = summarizeParticipants(outcome.participants);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>
        {outcome.mode === "created" ? "Archive created" : "Merged into your archive"}
      </Text>
      <Text style={styles.heading}>{session.chatTitle}</Text>

      <Text style={styles.lede}>
        {outcome.mode === "created"
          ? `${formatCount(outcome.messageCount)} messages are now encrypted on this phone.`
          : outcome.addedCount > 0
            ? `${formatCount(outcome.addedCount)} new messages added — ${formatCount(outcome.messageCount)} in the archive now.`
            : `Nothing new in this export. The archive already had all ${formatCount(outcome.messageCount)} of these messages.`}
      </Text>

      <Section title="What the archive holds">
        <Row label="Messages" value={formatCount(outcome.messageCount)} strong />
        <Row label="Date range" value={formatRange(outcome.firstTs, outcome.lastTs)} />
        {/*
          A family group has sixty participants and this is the screen someone reads to decide
          whether to delete a chat — it must not become a scroll past a wall of names.
        */}
        <Row
          label={outcome.participants.length > 2 ? `People (${formatCount(outcome.participants.length)})` : "People"}
          value={showEveryone ? outcome.participants.join(", ") : people.label}
        />
        {people.collapsible && (
          <Pressable
            onPress={() => setShowEveryone((value) => !value)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.disclosure, pressed && styles.buttonPressed]}
          >
            <Text style={styles.disclosureLabel}>
              {showEveryone ? "Show fewer" : `Show all ${formatCount(outcome.participants.length)}`}
            </Text>
          </Pressable>
        )}
        <Row label="Media files" value={formatCount(stats.uniqueBlobCount)} />
        <Row label="Media size" value={formatBytes(stats.totalBytes)} />
        {stats.dedupSavedBytes > 0 && (
          <Row label="Saved by dedup" value={formatBytes(stats.dedupSavedBytes)} />
        )}
      </Section>

      {/*
        The honest half, and the most carefully worded thing in the app. Rendered whether or
        not there is anything to report: an explicit "all of it" is itself information, and a
        section that only appears when there is bad news teaches users to skim past it when it
        does. The wording is computed in `explainMedia`, where it can be tested.
      */}
      {media.severity === "none" ? (
        <View style={styles.goodBox}>
          <Text style={styles.goodHeading}>{media.headline}</Text>
          <Text style={styles.lossBody}>{media.saved}</Text>
        </View>
      ) : (
        <View style={styles.lossBox}>
          <Text style={styles.lossHeading}>{media.headline}</Text>
          <Text style={styles.lossBody}>{media.saved}</Text>

          {media.causes.map((cause) => (
            <View key={cause.what} style={styles.cause}>
              <Text style={styles.causeWhat}>{cause.what}</Text>
              <Text style={styles.causeWhy}>{cause.why}</Text>
            </View>
          ))}

          {media.stillSaved !== undefined && (
            <View style={styles.stillSaved}>
              <Text style={styles.stillSavedText}>{media.stillSaved}</Text>
            </View>
          )}

          <Text style={styles.nextStepsTitle}>What can still be done</Text>
          {media.nextSteps.map((step, index) => (
            <View key={step} style={styles.step}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {outcome.issues.length > 0 && (
        <Section title="Lines the parser could not read">
          <Text style={styles.body}>
            {formatCount(outcome.issues.length)} of them. They were kept as text rather than
            dropped, but if this number is large the archive may not match what you see in
            WhatsApp — worth checking before you delete anything.
          </Text>
        </Section>
      )}

      <Section title="Check this yourself">
        <Text style={styles.body}>
          Open the chat in WhatsApp and compare. The message count and the dates above should
          match what is there. If they do not, do not delete the chat — tell us instead.
        </Text>
      </Section>

      <Button
        label="Read the archive"
        onPress={() => router.push({ pathname: "/archive/[id]", params: { id: session.archiveId } })}
      />
      <Button
        label="Now delete the chat in WhatsApp"
        onPress={() =>
          router.push({ pathname: "/delete-guide", params: { title: session.chatTitle } })
        }
        tone="quiet"
      />
      <Button label="Back to library" onPress={() => router.replace("/")} tone="quiet" />

      <Text style={styles.footnote}>
        ChatVault cannot delete anything from WhatsApp — no app can. The next screen shows you
        how to do it yourself, once you are satisfied with what is above.
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]} selectable>
        {value}
      </Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: "quiet";
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        tone === "quiet" && styles.buttonQuiet,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonLabel, tone === "quiet" && styles.buttonLabelQuiet]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48, gap: 8 },
  eyebrow: { fontSize: 13, fontWeight: "600", color: theme.good, letterSpacing: 0.3 },
  heading: { fontSize: 26, fontWeight: "600", color: theme.ink, letterSpacing: -0.5 },
  lede: { fontSize: 16, lineHeight: 24, color: theme.body, marginTop: 4, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 21, color: theme.body },
  section: { marginTop: 20, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: theme.muted, letterSpacing: 0.2 },
  sectionBody: {
    backgroundColor: theme.panel,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 4,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 9 },
  rowLabel: { fontSize: 14, color: theme.muted },
  rowValue: { fontSize: 14, fontWeight: "500", color: theme.ink, flexShrink: 1, textAlign: "right" },
  rowValueStrong: { fontSize: 17, fontWeight: "700" },
  lossBox: {
    marginTop: 20,
    padding: 16,
    gap: 8,
    borderRadius: radius.card,
    backgroundColor: "#fbf1ee",
    borderLeftWidth: 3,
    borderLeftColor: theme.bad,
  },
  lossHeading: { fontSize: 18, fontWeight: "600", color: theme.bad },
  lossBody: { fontSize: 14, lineHeight: 21, color: theme.body },
  cause: { marginTop: 10, gap: 3 },
  causeWhat: { fontSize: 14, fontWeight: "600", color: theme.ink },
  causeWhy: { fontSize: 14, lineHeight: 21, color: theme.body },
  stillSaved: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.chip,
    backgroundColor: "#eef4f0",
  },
  stillSavedText: { fontSize: 14, lineHeight: 21, color: "#1f5138" },
  nextStepsTitle: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: "700",
    color: theme.muted,
  },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 8 },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.ink,
    color: theme.paper,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
  },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21, color: theme.body },
  disclosure: { paddingVertical: 8 },
  disclosureLabel: { fontSize: 13, fontWeight: "600", color: theme.ink },
  goodBox: {
    marginTop: 20,
    padding: 16,
    gap: 6,
    borderRadius: radius.card,
    backgroundColor: "#eef4f0",
    borderLeftWidth: 3,
    borderLeftColor: theme.good,
  },
  goodHeading: { fontSize: 17, fontWeight: "600", color: theme.good },
  button: {
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: radius.card,
    alignItems: "center",
    backgroundColor: theme.ink,
  },
  buttonQuiet: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.hairline },
  buttonPressed: { opacity: 0.7 },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: theme.paper },
  buttonLabelQuiet: { color: theme.ink },
  footnote: { marginTop: 20, fontSize: 13, lineHeight: 20, color: theme.muted },
});
