import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { takeImportSession, type ImportSession } from "../lib/import/session";
import { createStyles, useApp } from "../components/app/providers";
import { Button, Callout, CalloutText, Row, Section, Step } from "../components/app/ui";
import { formatBytes, formatCount, formatRange } from "../lib/ui/format";
import { explainMedia } from "../lib/ui/media-explanation";
import { summarizeParticipants } from "../lib/ui/participants";
import { radius, space } from "../lib/ui/theme";

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
  const { t, tp, language } = useApp();
  const styles = useStyles();

  const [session, setSession] = useState<ImportSession | undefined>(undefined);
  const [showEveryone, setShowEveryone] = useState(false);

  useEffect(() => {
    // Read once, on mount. A cold start onto this route has no session — see the fallback.
    setSession(takeImportSession());
  }, []);

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>{t("verify.nothing.heading")}</Text>
        <Text style={styles.body}>{t("verify.nothing.body")}</Text>
        <Button label={t("common.backToLibrary")} onPress={() => router.replace("/")} />
      </ScrollView>
    );
  }

  const { outcome } = session;
  const { stats } = outcome;
  const media = explainMedia(stats, session.hadMedia, language);
  const people = summarizeParticipants(outcome.participants, undefined, language);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>
        {outcome.mode === "created" ? t("verify.eyebrow.created") : t("verify.eyebrow.merged")}
      </Text>
      <Text style={styles.heading}>{session.chatTitle}</Text>

      <Text style={styles.lede}>
        {outcome.mode === "created"
          ? t("verify.lede.created", { messages: tp("common.messages", outcome.messageCount) })
          : outcome.addedCount > 0
            ? t("verify.lede.added", {
                added: formatCount(outcome.addedCount),
                total: formatCount(outcome.messageCount),
              })
            : t("verify.lede.nothingNew", { total: formatCount(outcome.messageCount) })}
      </Text>

      <Section title={t("verify.holds")}>
        <Row label={t("verify.row.messages")} value={formatCount(outcome.messageCount)} strong />
        <Row
          label={t("verify.row.dateRange")}
          value={formatRange(outcome.firstTs, outcome.lastTs)}
        />
        {/*
          A family group has sixty participants and this is the screen someone reads to decide
          whether to delete a chat — it must not become a scroll past a wall of names.
        */}
        <Row
          label={
            outcome.participants.length > 2
              ? t("verify.row.peopleCount", { count: formatCount(outcome.participants.length) })
              : t("verify.row.people")
          }
          value={showEveryone ? outcome.participants.join(", ") : people.label}
        />
        {people.collapsible && (
          <Pressable
            onPress={() => setShowEveryone((value) => !value)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
          >
            <Text style={styles.disclosureLabel}>
              {showEveryone
                ? t("common.showFewer")
                : t("common.showAll", { count: formatCount(outcome.participants.length) })}
            </Text>
          </Pressable>
        )}
        <Row label={t("verify.row.mediaFiles")} value={formatCount(stats.uniqueBlobCount)} />
        <Row label={t("verify.row.mediaSize")} value={formatBytes(stats.totalBytes)} />
        {stats.dedupSavedBytes > 0 && (
          <Row label={t("verify.row.dedup")} value={formatBytes(stats.dedupSavedBytes)} />
        )}
      </Section>

      {/*
        The honest half, and the most carefully worded thing in the app. Rendered whether or
        not there is anything to report: an explicit "all of it" is itself information, and a
        section that only appears when there is bad news teaches users to skim past it when it
        does. The wording is computed in `explainMedia`, where it can be tested.
      */}
      {media.severity === "none" ? (
        <Callout tone="good" title={media.headline}>
          <CalloutText>{media.saved}</CalloutText>
        </Callout>
      ) : (
        <Callout tone="bad" title={media.headline}>
          <CalloutText>{media.saved}</CalloutText>

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

          <Text style={styles.nextStepsTitle}>{t("verify.nextSteps")}</Text>
          <View style={styles.steps}>
            {media.nextSteps.map((step, index) => (
              <Step key={step} index={index + 1} text={step} />
            ))}
          </View>
        </Callout>
      )}

      {outcome.issues.length > 0 && (
        <Section title={t("verify.issues.title")}>
          <Text style={styles.body}>
            {t("verify.issues.body", { count: formatCount(outcome.issues.length) })}
          </Text>
        </Section>
      )}

      <Section title={t("verify.check.title")}>
        <Text style={styles.body}>{t("verify.check.body")}</Text>
      </Section>

      <Button
        label={t("verify.cta.read")}
        onPress={() =>
          router.push({ pathname: "/archive/[id]", params: { id: session.archiveId } })
        }
      />
      <Button
        label={t("verify.cta.delete")}
        onPress={() =>
          router.push({ pathname: "/delete-guide", params: { title: session.chatTitle } })
        }
        tone="quiet"
      />
      <Button label={t("common.backToLibrary")} onPress={() => router.replace("/")} tone="quiet" />

      <Text style={styles.footnote}>{t("verify.footnote")}</Text>
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: 48, gap: space.sm },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    color: t.good,
    letterSpacing: 0.3,
    writingDirection: "auto",
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: t.ink,
    letterSpacing: -0.5,
    writingDirection: "auto",
  },
  lede: {
    fontSize: 16,
    lineHeight: 24,
    color: t.body,
    marginTop: space.xs,
    marginBottom: space.sm,
    writingDirection: "auto",
  },
  body: { fontSize: 14, lineHeight: 21, color: t.body, writingDirection: "auto" },
  cause: { marginTop: space.sm + 2, gap: 3 },
  causeWhat: { fontSize: 14, fontWeight: "700", color: t.ink, writingDirection: "auto" },
  causeWhy: { fontSize: 14, lineHeight: 21, color: t.body, writingDirection: "auto" },
  stillSaved: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.chip,
    backgroundColor: t.goodWash,
  },
  stillSavedText: {
    fontSize: 14,
    lineHeight: 21,
    color: t.dark ? t.body : "#1f5138",
    writingDirection: "auto",
  },
  nextStepsTitle: {
    marginTop: space.lg,
    fontSize: 13,
    fontWeight: "700",
    color: t.muted,
    writingDirection: "auto",
  },
  steps: { gap: space.md, marginTop: space.sm },
  disclosure: { paddingVertical: space.sm },
  disclosureLabel: { fontSize: 13, fontWeight: "700", color: t.accent },
  pressed: { opacity: 0.65 },
  footnote: {
    marginTop: space.xl,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    writingDirection: "auto",
  },
}));
