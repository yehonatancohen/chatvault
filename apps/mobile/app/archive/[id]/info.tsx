import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { mediaStats } from "@chatvault/core";
import { readPreferences, writePreferences } from "../../../lib/archive/preferences";
import { archiveLocationSummary } from "../../../lib/archive/vault";
import { useArchive } from "../../../components/archive/useArchive";
import { MediaGrid } from "../../../components/archive/MediaGrid";
import { Lightbox, type LightboxSubject } from "../../../components/archive/Lightbox";
import { buildMediaIndex, imagesOnly } from "../../../lib/ui/media-index";
import { formatBytes, formatCount, formatDateTime, formatRange } from "../../../lib/ui/format";
import { colorForParticipant } from "../../../lib/ui/participants";
import { explainMedia } from "../../../lib/ui/media-explanation";
import { radius, theme } from "../../../lib/ui/theme";

/**
 * Chat information — the screen behind the title, as every messaging app has.
 *
 * It answers what the chat view cannot: who is in this conversation, what media it holds, how
 * far back it reaches, where the file actually lives, and which exports it was built from. That
 * last one is peculiar to this product and is the most valuable thing here — an archive is the
 * union of everyone's exports, so "3 imports, most recently yesterday" is what tells a member
 * their contribution landed.
 *
 * The media gap is repeated here on purpose. Verify shows it once, at import; someone coming
 * back a month later to decide whether to delete the chat needs to find it again, and the
 * archive itself is the honest place to keep it rather than a notice that appeared once.
 */

/** How many participants to show before collapsing, matching what a group screen does. */
const VISIBLE_PARTICIPANTS = 8;
/** A taste of the gallery; the full grid is its own screen. */
const PREVIEW_TILES = 6;

export default function ArchiveInfoScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const archiveId = params.id ?? "";
  const { state } = useArchive(archiveId);

  const [selfId, setSelfId] = useState<string | undefined>(undefined);
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxSubject | undefined>(undefined);

  useEffect(() => {
    let stale = false;
    void (async () => {
      const preferences = await readPreferences(archiveId);
      if (!stale) setSelfId(preferences.selfParticipantId);
    })();
    return () => {
      stale = true;
    };
  }, [archiveId]);

  const chooseSelf = useCallback(
    async (participantId: string): Promise<void> => {
      // Tapping the current selection clears it — otherwise a mistake is unfixable.
      const next = selfId === participantId ? undefined : participantId;
      await writePreferences(archiveId, next === undefined ? {} : { selfParticipantId: next });
      setSelfId(next);
    },
    [archiveId, selfId],
  );

  const media = useMemo(
    () => (state.kind === "ready" ? buildMediaIndex(state.messages, state.manifest.media) : []),
    [state],
  );
  const images = useMemo(() => imagesOnly(media), [media]);

  if (state.kind !== "ready") {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "Chat info" }} />
        {state.kind === "error" ? (
          <>
            <Text style={styles.headingBad}>Could not read this archive</Text>
            <Text style={styles.body} selectable>
              {state.message}
            </Text>
          </>
        ) : state.kind === "locked" ? (
          <Text style={styles.body}>
            This archive is locked. Open it from the library and enter your passphrase.
          </Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const { manifest } = state;
  const stats = mediaStats(manifest.media, state.messages);
  // Whether the *original* export carried media is not recorded in the archive, so this infers
  // it: an archive holding attachments was built from at least one with-media export. The
  // inference only matters for the wording of a chat with no attachments at all, and there it
  // gives the right answer.
  const explanation = explainMedia(stats, stats.attachedCount > 0);

  const people = manifest.participants;
  const visiblePeople = showAllPeople ? people : people.slice(0, VISIBLE_PARTICIPANTS);
  const hiddenPeople = people.length - visiblePeople.length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Chat info" }} />

      <View style={styles.hero}>
        <Text style={styles.title}>{manifest.chatTitle}</Text>
        <Text style={styles.subtitle}>
          {formatCount(people.length)} {people.length === 1 ? "person" : "people"} ·{" "}
          {formatCount(manifest.messageCount)} messages
        </Text>
        <Text style={styles.subtitle}>{formatRange(manifest.firstTs, manifest.lastTs)}</Text>
      </View>

      <Section
        title={`Media (${formatCount(images.length)})`}
        action={
          images.length > PREVIEW_TILES
            ? {
                label: "See all",
                onPress: () =>
                  router.push({ pathname: "/archive/[id]/media", params: { id: archiveId } }),
              }
            : undefined
        }
      >
        <MediaGrid
          items={images.slice(0, PREVIEW_TILES)}
          reader={state.reader}
          onOpen={setLightbox}
        />
        <View style={styles.mediaFacts}>
          <Text style={styles.mediaFactsText}>
            {formatCount(stats.uniqueBlobCount)} files · {formatBytes(stats.totalBytes)}
            {media.length > images.length
              ? ` · ${formatCount(media.length - images.length)} video or audio, archived but not playable here`
              : ""}
          </Text>
        </View>

        {explanation.severity !== "none" && (
          <View style={styles.gap}>
            <Text style={styles.gapHeading}>{explanation.headline}</Text>
            {explanation.causes.map((cause) => (
              <Text key={cause.what} style={styles.gapBody}>
                {cause.what}. {cause.why}
              </Text>
            ))}
            <Text style={styles.gapBody}>{explanation.stillSaved}</Text>
          </View>
        )}
      </Section>

      <Section title={`${formatCount(people.length)} ${people.length === 1 ? "participant" : "participants"}`}>
        <Text style={styles.hint}>
          Tap whoever you are and your messages move to the right, like they do in WhatsApp. An
          export never says which name is yours — every line looks the same from outside.
        </Text>

        {visiblePeople.map((participant) => {
          const isSelf = selfId === participant.id;
          const otherNames = participant.aliases.filter((a) => a !== participant.displayName);
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
                style={[
                  styles.avatar,
                  { backgroundColor: colorForParticipant(participant.displayName) },
                ]}
              >
                <Text style={styles.avatarLetter}>
                  {[...participant.displayName][0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.personText}>
                <Text style={styles.personName} numberOfLines={1}>
                  {participant.displayName}
                </Text>
                {otherNames.length > 0 && (
                  <Text style={styles.personAliases} numberOfLines={1}>
                    also seen as {otherNames.join(", ")}
                  </Text>
                )}
              </View>
              {isSelf && <Text style={styles.youBadge}>You</Text>}
            </Pressable>
          );
        })}

        {/* The group-screen pattern: a row at the bottom that opens the rest in place. */}
        {(hiddenPeople > 0 || showAllPeople) && (
          <Pressable
            onPress={() => setShowAllPeople((value) => !value)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
          >
            <View style={styles.moreChevron}>
              <Text style={styles.moreChevronText}>{showAllPeople ? "▲" : "▼"}</Text>
            </View>
            <Text style={styles.moreLabel}>
              {showAllPeople ? "Show fewer" : `View all ${formatCount(people.length)}`}
            </Text>
          </Pressable>
        )}
      </Section>

      <Section
        title={`Built from ${formatCount(manifest.sources.length)} ${manifest.sources.length === 1 ? "export" : "exports"}`}
      >
        <Text style={styles.hint}>
          Every export anyone shares in is merged, never duplicated. Someone else's copy of this
          chat can reach further back than yours, and adding it only ever grows the archive.
        </Text>
        {[...manifest.sources]
          .sort((a, b) => b.importedAt - a.importedAt)
          .map((source) => (
            <View key={source.id} style={styles.source}>
              <Text style={styles.sourceWhen}>{formatDateTime(source.importedAt)}</Text>
              <Text style={styles.sourceWhat}>
                {source.contributor ?? "This phone"} · {source.dialect.platform} export
              </Text>
            </View>
          ))}
      </Section>

      <Section title="Where this is saved">
        <Text style={styles.body}>{archiveLocationSummary()}</Text>
        <Text style={styles.hint}>
          Nothing has ever been uploaded — there is no account and no server involved. The
          archive is encrypted before it is written, so even the files themselves give nothing
          away without your passphrase.
        </Text>
        <Text style={styles.hint}>
          It is included in your iPhone backup, which is what lets it survive a lost phone. The
          key is not: the Keychain entry stays on this device, so after restoring to a new phone
          the archive opens with your passphrase, and only with your passphrase.
        </Text>
        <View style={styles.pathBox}>
          <Text style={styles.pathText} selectable>
            Documents/archives/{archiveId}
          </Text>
        </View>
      </Section>

      <Section title="Archive">
        <Row label="Created" value={formatDateTime(manifest.createdAt)} />
        <Row label="Last updated" value={formatDateTime(manifest.updatedAt)} />
        <Row label="Chunks" value={formatCount(manifest.chunks.length)} />
        <Row label="Format version" value={String(manifest.formatVersion)} />
      </Section>

      <Lightbox subject={lightbox} onClose={() => setLightbox(undefined)} />
    </ScrollView>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  // `exactOptionalPropertyTypes` treats "absent" and "explicitly undefined" as different, and
  // this prop is genuinely conditional.
  action?: { label: string; onPress: () => void } | undefined;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        )}
      </View>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  hero: { alignItems: "center", paddingVertical: 16, gap: 4 },
  title: { fontSize: 24, fontWeight: "700", color: theme.ink, textAlign: "center" },
  subtitle: { fontSize: 13.5, color: theme.muted },
  headingBad: { fontSize: 20, fontWeight: "600", color: theme.bad },
  body: { fontSize: 14.5, lineHeight: 21, color: theme.body },
  section: { marginTop: 18, gap: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.muted },
  sectionAction: { fontSize: 13, fontWeight: "700", color: theme.good },
  sectionBody: {
    backgroundColor: theme.panel,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  hint: { fontSize: 13, lineHeight: 19, color: theme.muted },
  mediaFacts: { paddingTop: 8 },
  mediaFactsText: { fontSize: 13, color: theme.body },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
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
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.hairline,
  },
  moreChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.hairline,
  },
  moreChevronText: { fontSize: 11, color: theme.body },
  moreLabel: { fontSize: 15, fontWeight: "600", color: theme.ink },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 7 },
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
  source: { paddingVertical: 6, gap: 2 },
  sourceWhen: { fontSize: 14, color: theme.ink, fontWeight: "500" },
  sourceWhat: { fontSize: 12.5, color: theme.muted },
  pathBox: {
    marginTop: 4,
    padding: 10,
    borderRadius: radius.chip,
    backgroundColor: theme.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.hairline,
  },
  pathText: { fontFamily: "Menlo", fontSize: 11, color: theme.muted },
});
