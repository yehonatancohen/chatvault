import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { archiveBytes, readLibrary, type LibraryEntry } from "../../lib/archive/library";
import { backupPending } from "../../lib/drive/device-sync";
import { updateSettings } from "../../lib/settings/settings";
import { ChatAvatar } from "../../components/archive/ChatAvatar";
import { RemoveArchiveSheet } from "../../components/archive/RemoveArchiveSheet";
import { StatusPill } from "../../components/archive/StatusPill";
import { useChatStatus } from "../../components/archive/useChatStatus";
import { Onboarding } from "../../components/app/Onboarding";
import { createStyles, useApp } from "../../components/app/providers";
import { EmptyState } from "../../components/app/ui";
import { formatBytes, formatDate } from "../../lib/ui/format";
import { gutter, space, type } from "../../lib/ui/theme";

/**
 * The chat list. Deliberately spare: each row is the chat, its last message, and one status —
 * On this phone / Uploading / Safe to delete / Deleted — which is the only thing a user needs to
 * decide what to do next. Everything explanatory lives in Settings → Help.
 *
 * **Rows are full-bleed and divided by an inset line, not stacked as cards.** Every messaging
 * app a user has ever opened looks like this, and it is also the honest shape: a chat list is
 * one list, and eight rounded rectangles with gaps between them says it is eight things.
 *
 * Opening the list also backs up, in the background, any chat whose latest version is not in
 * the user's Drive yet (`backupPending`), so statuses advance by themselves.
 */

const AVATAR = 52;

function archiveMediaBytes(entry: LibraryEntry): number {
  return entry.manifest === undefined ? 0 : archiveBytes(entry.manifest);
}

export default function LibraryScreen() {
  const router = useRouter();
  const { t, tp, language, settings } = useApp();
  const styles = useStyles();
  const { hasShareIntent } = useShareIntentContext();

  const [entries, setEntries] = useState<readonly LibraryEntry[] | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<LibraryEntry | undefined>(undefined);
  const [tutorial, setTutorial] = useState(false);

  // First launch only (the empty dependency array is deliberate), and never over a cold start
  // into a share hand-off (`+native-intent.ts` sends that straight to `/import` — this screen
  // still mounts underneath as the stack's anchor, and a tutorial popping up over it would fight
  // the import for attention).
  useEffect(() => {
    if (!settings.sawTutorial && !hasShareIntent) setTutorial(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setTutorial(false);
    updateSettings({ sawTutorial: true });
  }, []);

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
          <View style={styles.emptyWrap}>
            <EmptyState
              heading={t("library.empty.heading")}
              graphic={<EmptyGraphic />}
              actionTone="help"
              action={{ label: t("library.empty.cta"), onPress: () => setTutorial(true) }}
            />
          </View>
        ) : (
          <>
            <Text style={styles.summary}>
              {tp("library.count", entries.length)}
              {totalMediaBytes > 0 ? ` · ${formatBytes(totalMediaBytes)}` : ""}
            </Text>
            <View>
              {entries.map((entry, index) => (
                <View key={entry.archiveId}>
                  {/* Inset past the avatar, the way every chat list is divided: a line running
                      the full width cuts the avatars off from their own rows. */}
                  {index > 0 && <View style={styles.separator} />}
                  <ArchiveRow
                    entry={entry}
                    onPress={() => router.push({ pathname: "/archive/[id]", params: { id: entry.archiveId } })}
                    onRemove={() => setRemoving(entry)}
                  />
                </View>
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

      {tutorial && <Onboarding onClose={closeTutorial} />}
    </>
  );
}

/** A large, ghosted chat bubble — the same silhouette `TabIcon`'s chats icon uses, scaled up and
 * tinted quiet, so an empty library reads as "chats go here" rather than a page that failed to
 * load. */
function EmptyGraphic() {
  const styles = useStyles();
  return <View style={styles.emptyGraphic} />;
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
          <Text style={locked ? styles.title : styles.titleBad} numberOfLines={1}>
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
      <ChatAvatar title={manifest.chatTitle} reader={entry.reader} thumbnail={entry.thumbnail} size={AVATAR} />
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
  // `flexGrow` rather than `flex`, and only on the content container: a `ScrollView` needs its
  // content to be told to grow, not the scroll view itself, or a short empty state just sits at
  // the top with nothing making the container claim the screen's full height.
  container: { flexGrow: 1, paddingTop: space.sm, paddingBottom: space.xxxl },
  loading: { paddingVertical: space.xxxl, alignItems: "center" },
  emptyWrap: { flex: 1, justifyContent: "center", paddingHorizontal: gutter },
  // The same silhouette as `TabIcon`'s `ChatsIcon` — including its un-mirrored tail corner,
  // matching that icon rather than introducing a different convention at a bigger size.
  emptyGraphic: {
    width: 96,
    height: 78,
    borderWidth: 3,
    borderColor: t.hairline,
    borderRadius: 26,
    borderBottomLeftRadius: 4,
  },
  summary: {
    ...type.micro,
    color: t.muted,
    paddingHorizontal: gutter,
    paddingBottom: space.md,
    writingDirection: "auto",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.separator,
    marginStart: gutter + AVATAR + space.md,
  },
  pressed: { backgroundColor: t.accentWash },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: gutter,
  },
  text: { flex: 1, gap: 3 },
  topLine: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  title: { flex: 1, ...type.heading, color: t.ink, writingDirection: "auto" },
  titleBad: { ...type.heading, color: t.bad, writingDirection: "auto" },
  when: { ...type.micro, fontWeight: "400", color: t.faint },
  statusLine: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: 2 },
  statusSlot: { flex: 1 },
  size: { ...type.micro, fontWeight: "400", color: t.faint },
  preview: { ...type.caption, color: t.muted, writingDirection: "auto" },
}));
