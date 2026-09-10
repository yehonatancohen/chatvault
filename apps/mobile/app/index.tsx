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
import { formatCount, formatDate, formatDateTime } from "../lib/ui/format";
import { radius, theme } from "../lib/ui/theme";

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
          <Text style={styles.heading}>
            {formatCount(entries.length)} {entries.length === 1 ? "archive" : "archives"}
          </Text>
          {entries.map((entry) => (
            <ArchiveCard
              key={entry.archiveId}
              entry={entry}
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

function ArchiveCard({ entry, onPress }: { entry: LibraryEntry; onPress: () => void }) {
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
