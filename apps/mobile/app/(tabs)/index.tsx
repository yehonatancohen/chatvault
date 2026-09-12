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
import { archiveBytes, readLibrary, type LibraryEntry } from "../../lib/archive/library";
import { backupPending } from "../../lib/drive/device-sync";
import { ChatAvatar } from "../../components/archive/ChatAvatar";
import { RemoveArchiveSheet } from "../../components/archive/RemoveArchiveSheet";
import { StatusPill } from "../../components/archive/StatusPill";
import { useChatStatus } from "../../components/archive/useChatStatus";
import { createStyles, useApp } from "../../components/app/providers";
import { Button } from "../../components/app/ui";
import { formatBytes, formatDate } from "../../lib/ui/format";
import { radius, space } from "../../lib/ui/theme";

/**
 * The chat list. Deliberately spare: each row is the chat, its last message, and one status —
 * On this phone / Uploading / Safe to delete / Deleted — which is the only thing a user needs to
 * decide what to do next. Everything explanatory lives in Settings → Help.
 *
 * Opening the list also backs up, in the background, any chat whose latest version is not in
 * the user's Drive yet (`backupPending`), so statuses advance by themselves.
 */

function archiveMediaBytes(entry: LibraryEntry): number {
  return entry.manifest === undefined ? 0 : archiveBytes(entry.manifest);
}

export default function LibraryScreen() {
  const router = useRouter();
  const { t, tp, language } = useApp();
  const styles = useStyles();

  const [entries, setEntries] = useState<readonly LibraryEntry[] | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<LibraryEntry | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    const next = await readLibrary(language);
    setEntries(next);
    void backupPending(
      next.flatMap((entry) =>
        entry.manifest ? [{ archiveId: entry.archiveId, updatedAt: entry.manifest.updatedAt }] : [],
      ),
    );
  }, [language]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const totalMediaBytes = (entries ?? []).reduce((sum, entry) => sum + archiveMediaBytes(entry), 0);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        {entries === undefined ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.heading}>{t("library.empty.heading")}</Text>
            <Button label={t("library.empty.cta")} onPress={() => router.push("/add")} />
          </View>
        ) : (
          <>
            <Text style={styles.summary}>
              {tp("library.count", entries.length)}
              {totalMediaBytes > 0 ? ` · ${formatBytes(totalMediaBytes)}` : ""}
            </Text>
            <View style={styles.list}>
              {entries.map((entry) => (
                <ArchiveRow
                  key={entry.archiveId}
                  entry={entry}
                  onPress={() => router.push({ pathname: "/archive/[id]", params: { id: entry.archiveId } })}
                  onRemove={() => setRemoving(entry)}
                />
              ))}
            </View>
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

function ArchiveRow({
  entry,
  onPress,
  onRemove,
}: {
  entry: LibraryEntry;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { t } = useApp();
  const styles = useStyles();

  if (entry.status !== "ready" || entry.manifest === undefined) {
    const locked = entry.status === "locked";
    return (
      <Pressable
        onPress={locked ? onPress : onRemove}
        onLongPress={onRemove}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          <Text style={locked ? styles.title : styles.titleBad}>
            {locked ? t("library.locked") : t("library.unreadable")}
          </Text>
          <Text style={styles.preview} numberOfLines={1} selectable={!locked}>
            {locked ? t("library.locked.hint") : (entry.problem ?? "")}
          </Text>
        </View>
      </Pressable>
    );
  }

  return <ChatRow entry={entry} manifestUpdatedAt={entry.manifest.updatedAt} onPress={onPress} onRemove={onRemove} />;
}

function ChatRow({
  entry,
  manifestUpdatedAt,
  onPress,
  onRemove,
}: {
  entry: LibraryEntry;
  manifestUpdatedAt: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const status = useChatStatus(entry.archiveId, manifestUpdatedAt);
  const manifest = entry.manifest!;
  const bytes = archiveBytes(manifest);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onRemove}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ChatAvatar title={manifest.chatTitle} reader={entry.reader} thumbnail={entry.thumbnail} />
      <View style={styles.text}>
        <View style={styles.topLine}>
          <Text style={styles.title} numberOfLines={1}>
            {manifest.chatTitle}
          </Text>
          <Text style={styles.when}>{formatDate(manifest.lastTs)}</Text>
        </View>
        {entry.lastMessage && (
          <Text style={styles.preview} numberOfLines={1}>
            {entry.lastMessage.sender !== null ? `${entry.lastMessage.sender}: ` : ""}
            {entry.lastMessage.text}
          </Text>
        )}
        {/* Status and size on one line: together they are the two facts that decide what to do
            with a chat — whether it is safe to delete, and how much it is holding. */}
        <View style={styles.statusLine}>
          {/* The pill keeps the free width so its progress bar, while a chat uploads, still has
              a row to stretch across. */}
          <View style={styles.statusSlot}>
            <StatusPill status={status} />
          </View>
          {bytes > 0 && <Text style={styles.size}>{formatBytes(bytes)}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  container: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  loading: { paddingVertical: 48, alignItems: "center" },
  empty: { paddingTop: space.xxl, gap: space.lg, alignItems: "stretch" },
  heading: { fontSize: 22, fontWeight: "700", color: t.ink, textAlign: "center", writingDirection: "auto" },
  summary: { fontSize: 13, color: t.muted, writingDirection: "auto" },
  list: { gap: space.sm },
  pressed: { opacity: 0.65 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    backgroundColor: t.panel,
  },
  text: { flex: 1, gap: 4 },
  topLine: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  title: { flex: 1, fontSize: 16.5, fontWeight: "600", color: t.ink, writingDirection: "auto" },
  titleBad: { fontSize: 16, fontWeight: "600", color: t.bad, writingDirection: "auto" },
  when: { fontSize: 12, color: t.muted },
  statusLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  statusSlot: { flex: 1 },
  size: { fontSize: 12, color: t.muted },
  preview: { fontSize: 14, color: t.body, writingDirection: "auto" },
}));
