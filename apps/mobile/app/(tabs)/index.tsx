import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { readLibrary, type LibraryEntry } from "../../lib/archive/library";
import { archiveLocationSummary } from "../../lib/archive/vault";
import { ChatAvatar } from "../../components/archive/ChatAvatar";
import { RemoveArchiveSheet } from "../../components/archive/RemoveArchiveSheet";
import { createStyles, useApp } from "../../components/app/providers";
import { Button, Section } from "../../components/app/ui";
import { formatBytes, formatCount, formatDate } from "../../lib/ui/format";
import { radius, space } from "../../lib/ui/theme";

/**
 * A7 — the library.
 *
 * Not the entry point: a user arrives at this app from WhatsApp's share sheet, having already
 * exported a chat. So the empty state is the important half of this screen — it exists to
 * explain how to produce an archive, and now to hand the reader straight to the Add tab, which
 * is where that explanation properly lives.
 *
 * Refreshes on focus. Importing happens on another screen, and coming back to a stale list
 * that does not show the archive you just made reads as the import having failed.
 *
 * **Long-press removes.** It is the destructive action, so it is not a visible button on every
 * row — but a broken archive gets an explicit Remove, because a row that cannot be opened gives
 * no way to discover the gesture, and being stuck with an archive that neither opens nor goes
 * away is the state this was built to fix.
 */

/**
 * Media bytes this archive holds — the sum over its stored blobs, deduped.
 *
 * This is the same quantity `mediaStats().totalBytes` reports on the Verify screen and the
 * same thing the design's big number stands for. It is *not* the archive's on-disk size
 * (chunks, envelopes and the manifest are not counted) and nothing in the format exposes that,
 * so the copy around this number talks about media held, not storage. A text-only archive
 * returns 0 and the screen shows a plain count instead.
 */
function archiveMediaBytes(entry: LibraryEntry): number {
  return entry.manifest?.media.reduce((sum, ref) => sum + ref.byteLength, 0) ?? 0;
}

/** `"4.82 GB"` -> `["4.82", "GB"]`; anything without a unit (e.g. `"-"`) -> `[value, ""]`. */
function splitMagnitude(formatted: string): readonly [string, string] {
  const space = formatted.lastIndexOf(" ");
  return space === -1 ? [formatted, ""] : [formatted.slice(0, space), formatted.slice(space + 1)];
}

export default function LibraryScreen() {
  const router = useRouter();
  const { t, tp, language } = useApp();
  const styles = useStyles();

  const [entries, setEntries] = useState<readonly LibraryEntry[] | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<LibraryEntry | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    setEntries(await readLibrary(language));
  }, [language]);

  useFocusEffect(
    useCallback(() => {
      let stale = false;
      void (async () => {
        const next = await readLibrary(language);
        if (!stale) setEntries(next);
      })();
      return () => {
        stale = true;
      };
    }, [language]),
  );

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Fattest first — the list is ordered by how much each chat is holding, which is also the
  // order in which someone deciding what to delete next wants to see them. Locked and
  // unreadable entries carry no size and fall to the end.
  const ordered = [...(entries ?? [])].sort((a, b) => archiveMediaBytes(b) - archiveMediaBytes(a));
  const totalMediaBytes = ordered.reduce((sum, entry) => sum + archiveMediaBytes(entry), 0);
  const archiveCount = ordered.length;
  const [mediaMagnitude, mediaUnit] = splitMagnitude(formatBytes(totalMediaBytes));

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        {entries === undefined ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState onLearn={() => router.push("/add")} />
        ) : (
          <>
            {/*
              The home screen leads with the number that is the point: how much media your own
              archives are holding for you, summed from their manifests. It is never a reading
              of WhatsApp — this app cannot and must not take one (root CLAUDE.md, invariants 1
              and 7) — and it is media only, not on-disk size, which the copy is careful to say.
            */}
            {totalMediaBytes > 0 ? (
              <View style={styles.hero}>
                <View style={styles.heroNumberRow}>
                  <Text style={styles.heroNumber}>{mediaMagnitude}</Text>
                  <Text style={styles.heroUnit}>{mediaUnit}</Text>
                </View>
                <Text style={styles.heroLine}>
                  {t("library.hero.line", {
                    archives: tp("common.archives", archiveCount),
                  })}
                </Text>
              </View>
            ) : (
              <Text style={styles.heading}>{tp("library.heading", archiveCount)}</Text>
            )}

            <View style={styles.list}>
              {ordered.map((entry) => (
                <ArchiveCard
                  key={entry.archiveId}
                  entry={entry}
                  mediaBytes={archiveMediaBytes(entry)}
                  onPress={() =>
                    router.push({ pathname: "/archive/[id]", params: { id: entry.archiveId } })
                  }
                  onRemove={() => setRemoving(entry)}
                />
              ))}
            </View>

            <Text style={styles.addMore}>{t("library.addMore")}</Text>
            <Text style={styles.hint}>{t("library.holdToManage")}</Text>

            {/*
              "Where are my chats saved?" is a fair question for an app asking someone to delete
              their originals. The short form lives here; chat info carries the full explanation,
              including backups.
            */}
            <Section title={t("library.storage.title")}>
              <Text style={styles.storageBody}>{archiveLocationSummary(language)}</Text>
              <Text style={styles.storageBody}>{t("library.storage.more")}</Text>
            </Section>
          </>
        )}
      </ScrollView>

      <RemoveArchiveSheet
        entry={removing}
        onClose={() => setRemoving(undefined)}
        onRemoved={() => {
          setRemoving(undefined);
          void load();
        }}
      />
    </>
  );
}

function ArchiveCard({
  entry,
  mediaBytes,
  onPress,
  onRemove,
}: {
  entry: LibraryEntry;
  mediaBytes: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { t, tp } = useApp();
  const styles = useStyles();

  if (entry.status === "locked") {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onRemove}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <Text style={styles.cardTitle}>{t("library.card.locked.title")}</Text>
        <Text style={styles.cardBody}>{t("library.card.locked.body")}</Text>
      </Pressable>
    );
  }

  if (entry.status === "unreadable") {
    return (
      <View style={[styles.card, styles.cardBad]}>
        <Text style={styles.cardTitleBad}>{t("library.card.unreadable.title")}</Text>
        <Text style={styles.cardBody} selectable>
          {entry.problem}
        </Text>
        <Text style={styles.cardBody}>{t("library.card.unreadable.warning")}</Text>
        {/*
          An explicit button, not the long-press the readable rows use: this row cannot be
          opened, so there is nothing to discover the gesture from, and a user looking at an
          archive that does not work needs the way out to be visible.
        */}
        <Button label={t("common.remove")} tone="quiet" onPress={onRemove} />
      </View>
    );
  }

  const manifest = entry.manifest!;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onRemove}
      accessibilityRole="button"
      accessibilityHint={t("library.holdToManage")}
      style={({ pressed }) => [styles.chatRow, pressed && styles.pressed]}
    >
      <ChatAvatar
        title={manifest.chatTitle}
        reader={entry.reader}
        thumbnail={entry.thumbnail}
      />

      <View style={styles.chatText}>
        <View style={styles.chatTopLine}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {manifest.chatTitle}
          </Text>
          <Text style={styles.chatWhen}>{formatDate(manifest.lastTs)}</Text>
        </View>

        {entry.lastMessage && (
          <Text style={styles.chatPreview} numberOfLines={1}>
            {entry.lastMessage.sender !== null ? `${entry.lastMessage.sender}: ` : ""}
            {entry.lastMessage.text}
          </Text>
        )}

        <Text style={styles.chatMeta} numberOfLines={1}>
          {mediaBytes > 0 ? (
            <>
              <Text style={styles.chatSize}>{formatBytes(mediaBytes)}</Text>
              {" · "}
            </>
          ) : null}
          {tp("common.messages", manifest.messageCount)} ·{" "}
          {tp("common.files", manifest.media.length)}
          {manifest.sources.length > 1
            ? ` · ${t("library.card.imports", { count: formatCount(manifest.sources.length) })}`
            : ""}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyState({ onLearn }: { onLearn: () => void }) {
  const { t } = useApp();
  const styles = useStyles();

  return (
    <View style={styles.empty}>
      <Text style={styles.heading}>{t("library.empty.heading")}</Text>
      <Text style={styles.body}>{t("library.empty.body")}</Text>
      <Button label={t("library.empty.cta")} onPress={onLearn} />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, paddingBottom: space.xxl, gap: space.md },
  loading: { paddingVertical: 48, alignItems: "center" },
  empty: { paddingTop: space.lg, gap: space.md },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: t.ink,
    letterSpacing: -0.4,
    writingDirection: "auto",
  },
  hero: { gap: space.sm + 2, paddingTop: space.sm, paddingBottom: space.xs },
  heroNumberRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  heroNumber: {
    fontSize: 64,
    fontWeight: "900",
    color: t.accent,
    letterSpacing: -2,
    lineHeight: 66,
  },
  heroUnit: { fontSize: 22, fontWeight: "900", color: t.accent },
  heroLine: { fontSize: 16, lineHeight: 23, color: t.body, writingDirection: "auto" },
  list: { gap: space.sm },
  chatSize: { fontWeight: "700", color: t.accent },
  body: { fontSize: 16, lineHeight: 24, color: t.body, writingDirection: "auto" },
  card: {
    padding: space.lg,
    gap: space.xs,
    borderRadius: radius.card,
    backgroundColor: t.panel,
  },
  cardBad: { backgroundColor: t.badWash },
  pressed: { opacity: 0.65 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: t.ink, writingDirection: "auto" },
  cardTitleBad: { fontSize: 16, fontWeight: "700", color: t.bad, writingDirection: "auto" },
  cardBody: { fontSize: 14, lineHeight: 21, color: t.body, writingDirection: "auto" },
  addMore: {
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: space.sm,
    writingDirection: "auto",
  },
  hint: { fontSize: 12.5, lineHeight: 18, color: t.muted, writingDirection: "auto" },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    backgroundColor: t.panel,
  },
  chatText: { flex: 1, gap: 2 },
  chatTopLine: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  chatTitle: {
    flex: 1,
    fontSize: 16.5,
    fontWeight: "600",
    color: t.ink,
    writingDirection: "auto",
  },
  chatWhen: { fontSize: 12, color: t.muted },
  chatPreview: { fontSize: 14, color: t.body, writingDirection: "auto" },
  chatMeta: { fontSize: 12, color: t.muted, writingDirection: "auto" },
  storageBody: { fontSize: 13, lineHeight: 19, color: t.muted, writingDirection: "auto" },
}));
