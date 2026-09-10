import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArchiveReader, mediaStats, type Manifest, type MediaStats } from "@chatvault/core";
import { getCryptoProvider } from "../../../lib/crypto/expo-crypto-provider";
import { loadArchiveKey, storageFor } from "../../../lib/archive/vault";
import { readPreferences, writePreferences } from "../../../lib/archive/preferences";
import { formatBytes, formatCount, formatDateTime, formatRange } from "../../../lib/ui/format";
import { colorForParticipant } from "../../../lib/ui/participants";
import { explainMedia } from "../../../lib/ui/media-explanation";
import { radius, theme } from "../../../lib/ui/theme";

/**
 * Chat information — the screen behind the title, as every messaging app has.
 *
 * It answers the questions the chat view cannot: who is in this conversation, how far back does
 * it reach, how much of it is media, and where did it come from. That last one is peculiar to
 * this product and is the most valuable thing here: an archive is the union of everyone's
 * exports, so "3 imports, most recently yesterday" is what tells a member their contribution
 * landed and what the archive is made of.
 *
 * It is also where the media gap is repeated. The Verify screen shows it once, at import; a
 * user who comes back a month later to decide whether to delete the chat needs to find it
 * again, and the archive itself is the honest place to keep it rather than a one-time notice.
 */

type State =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "ready";
      readonly manifest: Manifest;
      readonly stats: MediaStats;
      readonly selfId: string | undefined;
    };

export default function ArchiveInfoScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const archiveId = params.id ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let stale = false;
    void (async () => {
      try {
        const key = await loadArchiveKey(archiveId);
        if (key === null) throw new Error("This archive is locked. Open it from the library first.");

        const reader = await ArchiveReader.open({
          crypto: getCryptoProvider(),
          storage: storageFor(archiveId),
          key,
          archiveId,
        });
        // The whole archive's refs against the whole archive's messages — the same rule
        // `mediaStats` states for the Verify screen.
        const messages = await reader.readAll();
        const preferences = await readPreferences(archiveId);
        if (stale) return;

        setState({
          kind: "ready",
          manifest: reader.manifest,
          stats: mediaStats(reader.manifest.media, messages),
          selfId: preferences.selfParticipantId,
        });
      } catch (error) {
        if (stale) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return () => {
      stale = true;
    };
  }, [archiveId]);

  const chooseSelf = useCallback(
    async (participantId: string): Promise<void> => {
      if (state.kind !== "ready") return;
      // Tapping the current selection clears it — otherwise a mistake is unfixable.
      const next = state.selfId === participantId ? undefined : participantId;
      await writePreferences(archiveId, next === undefined ? {} : { selfParticipantId: next });
      setState({ ...state, selfId: next });
    },
    [archiveId, state],
  );

  if (state.kind === "loading") {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "Chat info" }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (state.kind === "error") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: "Chat info" }} />
        <Text style={styles.headingBad}>Could not read this archive</Text>
        <Text style={styles.body} selectable>
          {state.message}
        </Text>
        <Pressable
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Back to library</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const { manifest, stats } = state;
  // Whether the *original* export carried media is not recorded in the archive, so this infers
  // it: an archive holding attachments was built from at least one with-media export. The
  // inference only matters for the wording of a chat that has no attachments at all, and there
  // it gives the right answer.
  const media = explainMedia(stats, stats.attachedCount > 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Chat info" }} />

      <View style={styles.hero}>
        <Text style={styles.title}>{manifest.chatTitle}</Text>
        <Text style={styles.subtitle}>
          {formatCount(manifest.participants.length)}{" "}
          {manifest.participants.length === 1 ? "person" : "people"} ·{" "}
          {formatCount(manifest.messageCount)} messages
        </Text>
        <Text style={styles.subtitle}>{formatRange(manifest.firstTs, manifest.lastTs)}</Text>
      </View>

      <Section title={`People (${formatCount(manifest.participants.length)})`}>
        <Text style={styles.hint}>
          Tap whoever you are, and your messages will sit on the right like they do in WhatsApp.
          An export does not say which name is yours — every line looks the same from the
          outside.
        </Text>
        {manifest.participants.map((participant) => {
          const isSelf = state.selfId === participant.id;
          return (
            <Pressable
              key={participant.id}
              onPress={() => void chooseSelf(participant.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelf }}
              style={({ pressed }) => [
                styles.person,
                isSelf && styles.personSelf,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[styles.avatar, { backgroundColor: colorForParticipant(participant.displayName) }]}
              >
                <Text style={styles.avatarLetter}>
                  {[...participant.displayName][0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.personText}>
                <Text style={styles.personName} numberOfLines={1}>
                  {participant.displayName}
                </Text>
                {participant.aliases.length > 1 && (
                  <Text style={styles.personAliases} numberOfLines={1}>
                    also seen as {participant.aliases.filter((a) => a !== participant.displayName).join(", ")}
                  </Text>
                )}
              </View>
              {isSelf && <Text style={styles.youBadge}>You</Text>}
            </Pressable>
          );
        })}
      </Section>

      <Section title="Media">
        <Row label="Files held" value={formatCount(stats.uniqueBlobCount)} />
        <Row label="Size" value={formatBytes(stats.totalBytes)} />
        <Row label="Media messages" value={formatCount(stats.totalMediaMessages)} />
        {stats.dedupSavedBytes > 0 && (
          <Row label="Saved by dedup" value={formatBytes(stats.dedupSavedBytes)} />
        )}
        {media.severity !== "none" && (
          <View style={styles.gap}>
            <Text style={styles.gapHeading}>{media.headline}</Text>
            {media.causes.map((cause) => (
              <Text key={cause.what} style={styles.gapBody}>
                {cause.what}. {cause.why}
              </Text>
            ))}
            <Text style={styles.gapBody}>{media.stillSaved}</Text>
          </View>
        )}
      </Section>

      <Section title={`Built from ${formatCount(manifest.sources.length)} ${manifest.sources.length === 1 ? "export" : "exports"}`}>
        <Text style={styles.hint}>
          Each export anyone shares in is merged, never duplicated. Someone else's copy of this
          chat can reach further back than yours, and adding it only ever grows the archive.
        </Text>
        {[...manifest.sources]
          .sort((a, b) => b.importedAt - a.importedAt)
          .map((source) => (
            <View key={source.id} style={styles.source}>
              <Text style={styles.sourceWhen}>{formatDateTime(source.importedAt)}</Text>
              <Text style={styles.sourceWhat}>
                {source.contributor ?? "This phone"} · {source.dialect.platform} ·{" "}
                {source.dialect.dateOrder}
              </Text>
            </View>
          ))}
      </Section>

      <Section title="Archive">
        <Row label="Created" value={formatDateTime(manifest.createdAt)} />
        <Row label="Last updated" value={formatDateTime(manifest.updatedAt)} />
        <Row label="Chunks" value={formatCount(manifest.chunks.length)} />
        <Row label="Format version" value={String(manifest.formatVersion)} />
        <Text style={styles.hint}>
          Encrypted on this phone. Nothing has ever been uploaded, and your passphrase is the
          only way back in if this device is lost.
        </Text>
      </Section>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, gap: 6 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", paddingVertical: 16, gap: 4 },
  title: { fontSize: 24, fontWeight: "700", color: theme.ink, textAlign: "center" },
  subtitle: { fontSize: 13.5, color: theme.muted },
  headingBad: { fontSize: 20, fontWeight: "600", color: theme.bad },
  body: { fontSize: 15, lineHeight: 22, color: theme.body },
  section: { marginTop: 18, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.muted },
  sectionBody: {
    backgroundColor: theme.panel,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  hint: { fontSize: 13, lineHeight: 19, color: theme.muted, paddingVertical: 2 },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radius.chip,
  },
  personSelf: { backgroundColor: "#dcf3e4" },
  pressed: { opacity: 0.7 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#fff", fontSize: 16, fontWeight: "700" },
  personText: { flex: 1, gap: 1 },
  personName: { fontSize: 15.5, color: theme.ink, writingDirection: "auto" },
  personAliases: { fontSize: 12, color: theme.muted, writingDirection: "auto" },
  youBadge: { fontSize: 12, fontWeight: "700", color: theme.good },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 8 },
  rowLabel: { fontSize: 14, color: theme.muted },
  rowValue: { fontSize: 14, fontWeight: "500", color: theme.ink, flexShrink: 1, textAlign: "right" },
  gap: {
    marginTop: 10,
    padding: 12,
    gap: 6,
    borderRadius: radius.chip,
    backgroundColor: "#fbf1ee",
  },
  gapHeading: { fontSize: 14, fontWeight: "700", color: theme.bad },
  gapBody: { fontSize: 13, lineHeight: 19, color: theme.body },
  source: { paddingVertical: 7, gap: 2 },
  sourceWhen: { fontSize: 14, color: theme.ink, fontWeight: "500" },
  sourceWhat: { fontSize: 12.5, color: theme.muted },
  button: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: radius.card,
    alignItems: "center",
    backgroundColor: theme.ink,
  },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: theme.paper },
});
