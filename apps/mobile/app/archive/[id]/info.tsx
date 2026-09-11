import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { mediaStats } from "@chatvault/core";
import { readPreferences, updatePreferences } from "../../../lib/archive/preferences";
import { archiveLocationSummary } from "../../../lib/archive/vault";
import { readLibrary, type LibraryEntry } from "../../../lib/archive/library";
import { useArchive } from "../../../components/archive/useArchive";
import { MediaGrid } from "../../../components/archive/MediaGrid";
import { Lightbox, type LightboxSubject } from "../../../components/archive/Lightbox";
import { RemoveArchiveSheet } from "../../../components/archive/RemoveArchiveSheet";
import { ChatAvatar } from "../../../components/archive/ChatAvatar";
import { useChatPhoto } from "../../../components/archive/useChatPhoto";
import { createStyles, useApp } from "../../../components/app/providers";
import { Callout, CalloutText, LinkRow, Row, Section } from "../../../components/app/ui";
import { buildMediaIndex, findChatPhoto, imagesOnly } from "../../../lib/ui/media-index";
import { formatBytes, formatCount, formatDateTime, formatRange } from "../../../lib/ui/format";
import { colorForParticipant } from "../../../lib/ui/participants";
import { explainMedia } from "../../../lib/ui/media-explanation";
import { radius, space } from "../../../lib/ui/theme";

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
 *
 * **Removing the archive lives at the bottom**, below everything that describes what would be
 * lost. That ordering is the point: the library's long-press is the shortcut, and this is the
 * route that makes you scroll past the message count and the media first.
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
  const { t, tp, language } = useApp();
  const styles = useStyles();

  const [selfId, setSelfId] = useState<string | undefined>(undefined);
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxSubject | undefined>(undefined);
  const [removing, setRemoving] = useState<LibraryEntry | undefined>(undefined);
  const { chatPhotoSha256, setChatPhoto, lightboxAction } = useChatPhoto(archiveId);

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
      await updatePreferences(archiveId, { selfParticipantId: next });
      setSelfId(next);
    },
    [archiveId, selfId],
  );

  /**
   * The removal sheet takes a `LibraryEntry` so that one component serves both entry points.
   * This screen has the archive open already, so the entry is assembled from what is on screen
   * rather than re-read — except when the archive is not readable, where `readLibrary` is asked
   * for the real status so the sheet shows the right (gentler) confirmation.
   */
  const openRemove = useCallback(async (): Promise<void> => {
    if (state.kind === "ready") {
      setRemoving({ archiveId, status: "ready", manifest: state.manifest });
      return;
    }
    const entries = await readLibrary(language);
    setRemoving(entries.find((entry) => entry.archiveId === archiveId));
  }, [archiveId, state, language]);

  const media = useMemo(
    () => (state.kind === "ready" ? buildMediaIndex(state.messages, state.manifest.media) : []),
    [state],
  );
  const images = useMemo(() => imagesOnly(media), [media]);
  const chatPhoto = useMemo(() => findChatPhoto(media, chatPhotoSha256), [media, chatPhotoSha256]);

  if (state.kind !== "ready") {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t("info.title") }} />
        {state.kind === "error" ? (
          <>
            <Text style={styles.headingBad}>{t("info.error.heading")}</Text>
            <Text style={styles.body} selectable>
              {state.message}
            </Text>
          </>
        ) : state.kind === "locked" ? (
          <Text style={styles.body}>{t("info.locked")}</Text>
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
  const explanation = explainMedia(stats, stats.attachedCount > 0, language);

  const people = manifest.participants;
  const visiblePeople = showAllPeople ? people : people.slice(0, VISIBLE_PARTICIPANTS);
  const hiddenPeople = people.length - visiblePeople.length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: t("info.title") }} />

      <View style={styles.hero}>
        <ChatAvatar
          title={manifest.chatTitle}
          reader={state.reader}
          thumbnail={chatPhoto}
          size={88}
        />
        {chatPhoto !== undefined ? (
          <Pressable
            onPress={() => void setChatPhoto(undefined)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.photoLink}>{t("chatPhoto.remove")}</Text>
          </Pressable>
        ) : (
          images.length > 0 && <Text style={styles.photoHint}>{t("chatPhoto.hint")}</Text>
        )}
        <Text style={styles.title}>{manifest.chatTitle}</Text>
        <Text style={styles.subtitle}>
          {tp("common.people", people.length)} · {tp("common.messages", manifest.messageCount)}
        </Text>
        <Text style={styles.subtitle}>{formatRange(manifest.firstTs, manifest.lastTs)}</Text>
      </View>

      <Section
        title={t("info.media.title", { count: formatCount(images.length) })}
        action={
          images.length > PREVIEW_TILES
            ? {
                label: t("info.media.seeAll"),
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
            {t("info.media.facts", {
              files: tp("common.files", stats.uniqueBlobCount),
              size: formatBytes(stats.totalBytes),
            })}
            {media.length > images.length
              ? ` · ${t("info.media.notPlayable", {
                  count: formatCount(media.length - images.length),
                })}`
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

      <Section title={tp("info.people", people.length)}>
        <Text style={styles.hint}>{t("info.people.hint")}</Text>

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
                    {t("info.people.alsoSeenAs", { names: otherNames.join(", ") })}
                  </Text>
                )}
              </View>
              {isSelf && <Text style={styles.youBadge}>{t("info.people.you")}</Text>}
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
              {showAllPeople
                ? t("common.showFewer")
                : t("common.viewAll", { count: formatCount(people.length) })}
            </Text>
          </Pressable>
        )}
      </Section>

      <Section title={tp("info.sources", manifest.sources.length)}>
        <Text style={styles.hint}>{t("info.sources.hint")}</Text>
        {[...manifest.sources]
          .sort((a, b) => b.importedAt - a.importedAt)
          .map((source) => (
            <View key={source.id} style={styles.source}>
              <Text style={styles.sourceWhen}>{formatDateTime(source.importedAt)}</Text>
              <Text style={styles.sourceWhat}>
                {t("info.sources.platform", {
                  contributor: source.contributor ?? t("info.sources.thisPhone"),
                  platform: source.dialect.platform,
                })}
              </Text>
            </View>
          ))}
      </Section>

      <Section title={t("info.saved.title")}>
        <Text style={styles.body}>{archiveLocationSummary(language)}</Text>
        <Text style={styles.hint}>{t("info.saved.noAccount")}</Text>
        <Text style={styles.hint}>{t("info.saved.backup")}</Text>
        <View style={styles.pathBox}>
          <Text style={styles.pathText} selectable>
            Documents/archives/{archiveId}
          </Text>
        </View>
      </Section>

      <Section title={t("info.archive.title")}>
        <Row label={t("info.archive.created")} value={formatDateTime(manifest.createdAt)} />
        <Row label={t("info.archive.updated")} value={formatDateTime(manifest.updatedAt)} />
        <Row label={t("info.archive.chunks")} value={formatCount(manifest.chunks.length)} />
        <Row label={t("info.archive.format")} value={String(manifest.formatVersion)} />
      </Section>

      <Section title={t("info.danger.title")} footnote={t("remove.noteWhatsApp")}>
        <LinkRow label={t("remove.cta")} tone="danger" onPress={() => void openRemove()} />
      </Section>

      <Lightbox
        subject={lightbox}
        onClose={() => setLightbox(undefined)}
        action={lightboxAction(lightbox)}
      />
      <RemoveArchiveSheet
        entry={removing}
        onClose={() => setRemoving(undefined)}
        // The archive this screen is reading no longer exists, so there is nothing to return
        // to: go to the list rather than back to a reader that would fail to open.
        onRemoved={() => {
          setRemoving(undefined);
          router.replace("/");
        }}
      />
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl - 4, paddingBottom: 48, gap: space.xs + 2 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.sm + 2,
  },
  hero: { alignItems: "center", paddingVertical: space.lg, gap: space.xs },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: t.ink,
    textAlign: "center",
    writingDirection: "auto",
  },
  subtitle: { fontSize: 13.5, color: t.muted, writingDirection: "auto" },
  photoLink: { fontSize: 13, fontWeight: "600", color: t.accent, writingDirection: "auto" },
  photoHint: { fontSize: 12.5, color: t.muted, textAlign: "center", writingDirection: "auto" },
  headingBad: { fontSize: 20, fontWeight: "700", color: t.bad, writingDirection: "auto" },
  body: { fontSize: 14.5, lineHeight: 21, color: t.body, writingDirection: "auto" },
  hint: { fontSize: 13, lineHeight: 19, color: t.muted, writingDirection: "auto" },
  mediaFacts: { paddingTop: space.sm },
  mediaFactsText: { fontSize: 13, color: t.body, writingDirection: "auto" },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: 6,
    borderRadius: radius.chip,
  },
  personSelf: { backgroundColor: t.goodWash },
  pressed: { opacity: 0.65 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontSize: 16, fontWeight: "700" },
  personText: { flex: 1, gap: 1 },
  personName: { fontSize: 15.5, color: t.ink, writingDirection: "auto" },
  personAliases: { fontSize: 12, color: t.muted, writingDirection: "auto" },
  youBadge: { fontSize: 12, fontWeight: "700", color: t.good },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: 6,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.hairline,
  },
  moreChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.hairline,
  },
  moreChevronText: { fontSize: 11, color: t.body },
  moreLabel: { fontSize: 15, fontWeight: "600", color: t.ink, writingDirection: "auto" },
  gap: {
    marginTop: space.sm + 2,
    padding: space.md,
    gap: space.xs + 2,
    borderRadius: radius.chip,
    backgroundColor: t.badWash,
  },
  gapHeading: { fontSize: 14, fontWeight: "700", color: t.bad, writingDirection: "auto" },
  gapBody: { fontSize: 13, lineHeight: 19, color: t.body, writingDirection: "auto" },
  source: { paddingVertical: 6, gap: 2 },
  sourceWhen: { fontSize: 14, color: t.ink, fontWeight: "500" },
  sourceWhat: { fontSize: 12.5, color: t.muted, writingDirection: "auto" },
  pathBox: {
    marginTop: space.xs,
    padding: space.sm + 2,
    borderRadius: radius.chip,
    backgroundColor: t.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
  },
  // A filesystem path is never RTL, and letting it mirror puts the leading slash on the wrong
  // end of something the user may be reading against a real path.
  pathText: {
    fontFamily: "Menlo",
    fontSize: 11,
    color: t.muted,
    textAlign: "left",
    writingDirection: "ltr",
  },
}));
