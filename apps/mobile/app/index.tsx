import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { readLibrary, type LibraryEntry } from "../lib/archive/library";
import { archiveLocationSummary } from "../lib/archive/vault";
import { ChatAvatar } from "../components/archive/ChatAvatar";
import { formatBytes, formatCount, formatDate, formatDateTime } from "../lib/ui/format";
import { radius, theme } from "../lib/ui/theme";

/**
 * Media bytes this archive holds — the sum over its stored blobs, deduped.
 *
 * This is the same quantity `mediaStats().totalBytes` reports on the Verify screen and the
 * same thing the design's big number stands for ("38 ג׳יגה … רובם מדיה"). It is *not* the
 * archive's on-disk size (chunks, envelopes and the manifest are not counted) and nothing in
 * the format exposes that, so the copy around this number talks about media held, not storage.
 * A text-only archive returns 0 and the screen shows a plain count instead.
 */
function archiveMediaBytes(entry: LibraryEntry): number {
  return entry.manifest?.media.reduce((sum, ref) => sum + ref.byteLength, 0) ?? 0;
}

/** `"4.82 GB"` -> `["4.82", "GB"]`; anything without a unit (e.g. `"-"`) -> `[value, ""]`. */
function splitMagnitude(formatted: string): readonly [string, string] {
  const space = formatted.lastIndexOf(" ");
  return space === -1 ? [formatted, ""] : [formatted.slice(0, space), formatted.slice(space + 1)];
}

/**
 * A7 — the library.
 *
 * Not the entry point: a user arrives at this app from WhatsApp's share sheet, having already
 * exported a chat. So the empty state is the important half of this screen — it exists to
 * explain how to produce an archive, and to be honest about the two things people get wrong
 * before they start.
 *
 * Refreshes on focus. Importing happens on another screen, and coming back to a stale list
 * that does not show the archive you just made reads as the import having failed.
 */

export default function LibraryScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<readonly LibraryEntry[] | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setEntries(await readLibrary());
  }, []);

  useFocusEffect(
    useCallback(() => {
      let stale = false;
      void (async () => {
        const next = await readLibrary();
        if (!stale) setEntries(next);
      })();
      return () => {
        stale = true;
      };
    }, []),
  );

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Fattest first — the design's list is ordered by how much each chat is holding, which is
  // also the order in which someone deciding what to delete next wants to see them. Locked
  // and unreadable entries carry no size and fall to the end.
  const ordered = [...(entries ?? [])].sort((a, b) => archiveMediaBytes(b) - archiveMediaBytes(a));
  const totalMediaBytes = ordered.reduce((sum, entry) => sum + archiveMediaBytes(entry), 0);
  const archiveCount = ordered.length;
  const [mediaMagnitude, mediaUnit] = splitMagnitude(formatBytes(totalMediaBytes));

  return (
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
        <EmptyState />
      ) : (
        <>
          {/*
            The Boydem home leads with the number that is the point: how much media your own
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
                of media, kept across{" "}
                {archiveCount === 1 ? "one archive" : `${formatCount(archiveCount)} archives`} you
                own — encrypted on this phone, stored where you chose.
              </Text>
            </View>
          ) : (
            <Text style={styles.heading}>
              {formatCount(archiveCount)} {archiveCount === 1 ? "archive" : "archives"}
            </Text>
          )}

          {ordered.map((entry) => (
            <ArchiveCard
              key={entry.archiveId}
              entry={entry}
              mediaBytes={archiveMediaBytes(entry)}
              onPress={() =>
                router.push({ pathname: "/archive/[id]", params: { id: entry.archiveId } })
              }
            />
          ))}
          <Text style={styles.addMore}>
            To add to an archive — or to start another — export a chat in WhatsApp and share it
            here. An export of a chat you have already archived is merged in, not duplicated.
          </Text>

          {/*
            "Where are my chats saved?" is a fair question for an app asking someone to delete
            their originals, and it had no answer anywhere in the UI. The short form lives here;
            chat info carries the full explanation, including backups.
          */}
          <View style={styles.storageNote}>
            <Text style={styles.storageNoteTitle}>Where these are saved</Text>
            <Text style={styles.storageNoteBody}>{archiveLocationSummary()}</Text>
            <Text style={styles.storageNoteBody}>
              Open a chat and tap Info for the full picture, including what happens to your
              archive when you back up or replace your phone.
            </Text>
          </View>
        </>
      )}

      {/*
        Dev builds only. The storage adapter's conformance suite cannot run in CI — the
        filesystem it uses is a native module — so the only way to run it is from inside the
        app. `__DEV__` is false in a release bundle, so this never reaches a user.
      */}
      {__DEV__ && (
        <Link href="/dev-storage" style={styles.devLink}>
          Dev: run the device checks
        </Link>
      )}
    </ScrollView>
  );
}

function ArchiveCard({
  entry,
  mediaBytes,
  onPress,
}: {
  entry: LibraryEntry;
  mediaBytes: number;
  onPress: () => void;
}) {
  if (entry.status === "locked") {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <Text style={styles.cardTitle}>Locked archive</Text>
        <Text style={styles.cardBody}>
          This phone does not hold the key for this archive — after a restore or a reinstall,
          that is normal. Open it and enter your passphrase.
        </Text>
      </Pressable>
    );
  }

  if (entry.status === "unreadable") {
    return (
      <View style={[styles.card, styles.cardBad]}>
        <Text style={styles.cardTitleBad}>This archive does not open</Text>
        <Text style={styles.cardBody} selectable>
          {entry.problem}
        </Text>
        <Text style={styles.cardBody}>
          Do not delete this chat in WhatsApp if you have not already.
        </Text>
      </View>
    );
  }

  const manifest = entry.manifest!;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.chatRow, pressed && styles.pressed]}
    >
      <ChatAvatar
        archiveId={entry.archiveId}
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
          {formatCount(manifest.messageCount)} messages · {formatCount(manifest.media.length)} files
          {manifest.sources.length > 1 ? ` · ${formatCount(manifest.sources.length)} imports` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <>
      <Text style={styles.heading}>No archives yet</Text>

      <Text style={styles.body}>
        In WhatsApp, open a chat, tap the chat name, and choose{" "}
        <Text style={styles.emphasis}>Export chat</Text>. Then pick ChatVault from the share
        sheet.
      </Text>

      <View style={styles.note}>
        <Text style={styles.noteHeading}>Two things worth knowing first</Text>
        <Text style={styles.noteBody}>
          WhatsApp caps an export at about 40,000 messages, or 10,000 if you include media,
          counting back from the most recent. Archiving again later picks up where this one
          stops — and so does anyone else in the group who archives their own copy.
        </Text>
        <Text style={styles.noteBody}>
          ChatVault cannot delete anything from WhatsApp; no app can. Once your archive is
          saved and verified, we will show you how to delete the chat yourself.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  loading: { paddingVertical: 48, alignItems: "center" },
  heading: { fontSize: 24, fontWeight: "600", color: theme.ink, letterSpacing: -0.4 },
  hero: { gap: 10, paddingTop: 8, paddingBottom: 4 },
  heroNumberRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  heroNumber: {
    fontSize: 64,
    fontWeight: "900",
    color: theme.accent,
    letterSpacing: -2,
    lineHeight: 66,
  },
  heroUnit: { fontSize: 22, fontWeight: "900", color: theme.accent },
  heroLine: { fontSize: 16, lineHeight: 23, color: theme.body },
  chatSize: { fontWeight: "700", color: theme.accent },
  body: { fontSize: 16, lineHeight: 24, color: theme.body },
  emphasis: { fontWeight: "600", color: theme.ink },
  card: {
    padding: 16,
    gap: 4,
    borderRadius: radius.card,
    backgroundColor: theme.panel,
  },
  cardBad: { backgroundColor: "#fbf1ee" },
  pressed: { opacity: 0.7 },
  cardTitle: { fontSize: 17, fontWeight: "600", color: theme.ink },
  cardTitleBad: { fontSize: 16, fontWeight: "600", color: theme.bad },
  cardMeta: { fontSize: 14, color: theme.body },
  cardBody: { fontSize: 14, lineHeight: 21, color: theme.body },
  cardFoot: { marginTop: 4, fontSize: 12, color: theme.muted },
  addMore: { fontSize: 13, lineHeight: 20, color: theme.muted, marginTop: 8 },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    backgroundColor: theme.panel,
  },
  chatText: { flex: 1, gap: 2 },
  chatTopLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  chatTitle: { flex: 1, fontSize: 16.5, fontWeight: "600", color: theme.ink, writingDirection: "auto" },
  chatWhen: { fontSize: 12, color: theme.muted },
  chatPreview: { fontSize: 14, color: theme.body, writingDirection: "auto" },
  chatMeta: { fontSize: 12, color: theme.muted },
  storageNote: {
    marginTop: 14,
    padding: 14,
    gap: 6,
    borderRadius: radius.card,
    backgroundColor: theme.panel,
  },
  storageNoteTitle: { fontSize: 13.5, fontWeight: "700", color: theme.ink },
  storageNoteBody: { fontSize: 13, lineHeight: 19, color: theme.muted },
  note: {
    marginTop: 8,
    padding: 16,
    gap: 10,
    borderRadius: radius.card,
    backgroundColor: theme.panel,
  },
  noteHeading: { fontSize: 14, fontWeight: "600", color: theme.ink },
  noteBody: { fontSize: 14, lineHeight: 21, color: "#5c594f" },
  devLink: {
    marginTop: 8,
    fontSize: 13,
    color: theme.muted,
    textDecorationLine: "underline",
  },
});
