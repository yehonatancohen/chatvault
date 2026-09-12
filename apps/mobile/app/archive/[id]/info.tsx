import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Share, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { mediaStats } from "@chatvault/core";
import { readPreferences, updatePreferences } from "../../../lib/archive/preferences";
import { readLibrary, type LibraryEntry } from "../../../lib/archive/library";
import { useArchive } from "../../../components/archive/useArchive";
import { MediaGrid } from "../../../components/archive/MediaGrid";
import { Lightbox, type LightboxSubject } from "../../../components/archive/Lightbox";
import { RemoveArchiveSheet } from "../../../components/archive/RemoveArchiveSheet";
import { ChatAvatar } from "../../../components/archive/ChatAvatar";
import { DriveBackup } from "../../../components/archive/DriveBackup";
import { MediaNote } from "../../../components/archive/MediaNote";
import { StatusPill } from "../../../components/archive/StatusPill";
import { useChatStatus } from "../../../components/archive/useChatStatus";
import { isChatShared, shareChat, stopSharingChat } from "../../../lib/drive/share";
import { useChatPhoto } from "../../../components/archive/useChatPhoto";
import { createStyles, useApp } from "../../../components/app/providers";
import { Body, LinkRow, Row, Screen, Section, Title } from "../../../components/app/ui";
import { buildMediaIndex, findChatPhoto, imagesOnly } from "../../../lib/ui/media-index";
import { formatBytes, formatCount, formatRange } from "../../../lib/ui/format";
import { colorForParticipant } from "../../../lib/ui/participants";
import { explainMedia } from "../../../lib/ui/media-explanation";
import { radius, space, TAP, type } from "../../../lib/ui/theme";

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
  const status = useChatStatus(archiveId, state.kind === "ready" ? state.manifest.updatedAt : 0);

  // Sharing by link: Drive's "anyone with the link" on the chat's folder, and the website's
  // viewer. Only offered once the chat is in Drive (the link points at its folder).
  const [shared, setShared] = useState(false);
  const [shareProblem, setShareProblem] = useState<string | undefined>(undefined);
  useEffect(() => {
    void isChatShared(archiveId).then(setShared);
  }, [archiveId]);
  const share = useCallback(async () => {
    setShareProblem(undefined);
    try {
      const link = await shareChat(archiveId);
      setShared(true);
      const title = state.kind === "ready" ? state.manifest.chatTitle : "";
      await Share.share({ message: t("share.message", { chat: title, link }) });
    } catch (error) {
      setShareProblem(error instanceof Error ? error.message : String(error));
    }
  }, [archiveId, state, t]);
  const unshare = useCallback(async () => {
    setShareProblem(undefined);
    try {
      await stopSharingChat(archiveId);
      setShared(false);
    } catch (error) {
      setShareProblem(error instanceof Error ? error.message : String(error));
    }
  }, [archiveId]);

  if (state.kind !== "ready") {
    if (state.kind === "error") {
      return (
        <Screen>
          <Stack.Screen options={{ title: t("info.title") }} />
          <Title text={t("info.error.heading")} />
          <Body muted>{state.message}</Body>
        </Screen>
      );
    }
    if (state.kind === "locked") {
      return (
        <Screen>
          <Stack.Screen options={{ title: t("info.title") }} />
          <Body>{t("info.locked")}</Body>
        </Screen>
      );
    }
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t("info.title") }} />
        <ActivityIndicator />
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
    <Screen>
      <Stack.Screen options={{ title: t("info.title") }} />

      <View style={styles.hero}>
        <ChatAvatar title={manifest.chatTitle} reader={state.reader} thumbnail={chatPhoto} size={88} />
        {chatPhoto !== undefined && (
          <Pressable
            onPress={() => void setChatPhoto(undefined)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.photoLink}>{t("chatPhoto.remove")}</Text>
          </Pressable>
        )}
        <Text style={styles.title}>{manifest.chatTitle}</Text>
        <Text style={styles.subtitle}>
          {tp("common.messages", manifest.messageCount)} · {formatRange(manifest.firstTs, manifest.lastTs)}
        </Text>
        <StatusPill status={status} />
      </View>

      <Section title={t("info.drive")} footnote={shareProblem}>
        <DriveBackup archiveId={archiveId} updatedAt={manifest.updatedAt} />
        {(status.kind === "safe" || status.kind === "deleted") && (
          <LinkRow
            label={shared ? t("share.again") : t("share.cta")}
            onPress={() => void share()}
          />
        )}
        {shared && <LinkRow label={t("share.stop")} tone="danger" onPress={() => void unshare()} />}
        {(status.kind === "safe" || status.kind === "deleted") && (
          <LinkRow
            label={t("verify.cta.delete")}
            onPress={() =>
              router.push({ pathname: "/delete-guide", params: { id: archiveId, title: manifest.chatTitle } })
            }
          />
        )}
      </Section>

      <Section
        title={t("info.media.title", { count: formatCount(images.length) })}
        action={
          images.length > PREVIEW_TILES
            ? {
                label: t("info.media.seeAll"),
                onPress: () => router.push({ pathname: "/archive/[id]/media", params: { id: archiveId } }),
              }
            : undefined
        }
        footnote={
          images.length > 0 && images.length <= PREVIEW_TILES && chatPhoto === undefined
            ? t("chatPhoto.hint")
            : undefined
        }
      >
        <View style={styles.gridSlot}>
          <MediaGrid items={images.slice(0, PREVIEW_TILES)} reader={state.reader} onOpen={setLightbox} />
        </View>
        <MediaNote explanation={explanation} missing={stats.notArchivedCount} />
      </Section>

      <Section title={tp("info.people", people.length)} footnote={t("info.people.hint")}>
        {visiblePeople.map((participant) => {
          const isSelf = selfId === participant.id;
          return (
            <Pressable
              key={participant.id}
              onPress={() => void chooseSelf(participant.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelf }}
              style={({ pressed }) => [styles.person, pressed && styles.pressed]}
            >
              <View style={[styles.avatar, { backgroundColor: colorForParticipant(participant.displayName) }]}>
                <Text style={styles.avatarLetter}>{[...participant.displayName][0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <Text style={styles.personName} numberOfLines={1}>
                {participant.displayName}
              </Text>
              {isSelf && <Text style={styles.youBadge}>{t("info.people.you")}</Text>}
            </Pressable>
          );
        })}
        {(hiddenPeople > 0 || showAllPeople) && (
          <Pressable
            onPress={() => setShowAllPeople((value) => !value)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
          >
            <Text style={styles.moreLabel}>
              {showAllPeople ? t("common.showFewer") : t("common.viewAll", { count: formatCount(people.length) })}
            </Text>
          </Pressable>
        )}
      </Section>

      <Section>
        {/* What this chat is holding. The same number the chat list shows on each row, and the
            one a user weighing "should I keep this?" is actually asking about. */}
        <Row label={t("info.size")} value={formatBytes(stats.totalBytes)} />
        <Row
          label={t("info.passphrase")}
          value={state.reader.encrypted ? t("info.passphrase.on") : t("info.passphrase.off")}
        />
        <LinkRow label={t("remove.cta")} tone="danger" onPress={() => void openRemove()} />
      </Section>

      <Lightbox subject={lightbox} onClose={() => setLightbox(undefined)} action={lightboxAction(lightbox)} />
      <RemoveArchiveSheet
        entry={removing}
        onClose={() => setRemoving(undefined)}
        // The archive this screen is reading no longer exists, so go to the list.
        onRemoved={() => {
          setRemoving(undefined);
          router.replace("/");
        }}
      />
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  hero: { alignItems: "center", paddingTop: space.sm, gap: space.sm },
  title: { ...type.title, color: t.ink, textAlign: "center", writingDirection: "auto" },
  subtitle: { ...type.caption, color: t.muted, textAlign: "center", writingDirection: "auto" },
  photoLink: { ...type.micro, color: t.accent, writingDirection: "auto" },
  // The grid is the one child of a section that brings its own rhythm, so it gets the padding
  // a row would have given it rather than sitting flush against the separators.
  gridSlot: { paddingVertical: space.md },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TAP,
    paddingVertical: space.sm,
  },
  pressed: { opacity: 0.6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontSize: 15, fontWeight: "700" },
  personName: { flex: 1, ...type.label, fontWeight: "400", color: t.ink, writingDirection: "auto" },
  // The one participant marked as the reader. `good` rather than `accent`: it is a fact about
  // the chat, not something to tap.
  youBadge: {
    ...type.micro,
    color: t.good,
    backgroundColor: t.goodWash,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  moreRow: { minHeight: TAP, justifyContent: "center", paddingVertical: space.md },
  moreLabel: { ...type.label, color: t.accent, writingDirection: "auto" },
}));
