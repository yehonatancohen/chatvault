import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useArchive } from "../../../components/archive/useArchive";
import { MediaTile } from "../../../components/archive/MediaGrid";
import { Lightbox, type LightboxSubject } from "../../../components/archive/Lightbox";
import { buildMediaIndex, imagesOnly, type MediaItem } from "../../../lib/ui/media-index";
import { formatBytes, formatCount, formatDate } from "../../../lib/ui/format";
import { theme } from "../../../lib/ui/theme";

/**
 * Every photo in the archive, newest first — the "Media" screen every messaging app has.
 *
 * A `FlatList` of rows rather than a wrapping `View` of tiles, because each tile decrypts its
 * own blob on mount: virtualization is what keeps a chat with four hundred photos from
 * decrypting four hundred photos to draw one screen.
 *
 * Videos and audio are counted but not shown. There is no player in this app yet, and a grid
 * of grey squares that do nothing when tapped would be a worse answer than a line of text
 * saying they are safely archived.
 */

const COLUMNS = 3;

export default function ArchiveMediaScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { state } = useArchive(params.id ?? "");
  const [lightbox, setLightbox] = useState<LightboxSubject | undefined>(undefined);

  const all = useMemo(
    () => (state.kind === "ready" ? buildMediaIndex(state.messages, state.manifest.media) : []),
    [state],
  );
  const images = useMemo(() => imagesOnly(all), [all]);
  const rows = useMemo(() => chunk(images, COLUMNS), [images]);

  if (state.kind !== "ready") {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "Media" }} />
        {state.kind === "error" ? (
          <Text style={styles.error} selectable>
            {state.message}
          </Text>
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

  const otherKinds = all.length - images.length;
  const totalBytes = all.reduce((sum, item) => sum + item.byteLength, 0);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: `Media (${formatCount(images.length)})` }} />

      <FlatList
        data={rows}
        keyExtractor={(row) => row[0]?.sha256 ?? "empty"}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((item) => (
              <MediaTile
                key={item.sha256}
                item={item}
                reader={state.reader}
                columns={COLUMNS}
                onOpen={setLightbox}
              />
            ))}
            {/* Keeps the last, partial row left-aligned rather than stretched. */}
            {row.length < COLUMNS &&
              Array.from({ length: COLUMNS - row.length }, (_, i) => (
                <View key={`filler-${i}`} style={styles.filler} />
              ))}
          </View>
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerText}>
              {formatCount(images.length)} {images.length === 1 ? "photo" : "photos"} ·{" "}
              {formatBytes(totalBytes)} in this archive
            </Text>
            {otherKinds > 0 && (
              <Text style={styles.headerNote}>
                {formatCount(otherKinds)} {otherKinds === 1 ? "video or audio file is" : "videos and audio files are"}{" "}
                also archived. They cannot be played in the app yet — they are in the file,
                and the web viewer can open them.
              </Text>
            )}
            {images.length > 0 && (
              <Text style={styles.headerNote}>
                {formatDate(images[images.length - 1]!.ts)} — {formatDate(images[0]!.ts)}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            This archive holds no photos. Anything the export carried would appear here.
          </Text>
        }
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />

      <Lightbox subject={lightbox} onClose={() => setLightbox(undefined)} />
    </View>
  );
}

function chunk(items: readonly MediaItem[], size: number): MediaItem[][] {
  const rows: MediaItem[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.paper },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  list: { padding: 14, paddingBottom: 40 },
  row: { flexDirection: "row" },
  filler: { width: `${100 / COLUMNS}%` },
  header: { paddingBottom: 12, gap: 6 },
  headerText: { fontSize: 14, color: theme.body },
  headerNote: { fontSize: 12.5, lineHeight: 18, color: theme.muted },
  body: { fontSize: 15, lineHeight: 22, color: theme.body, textAlign: "center" },
  error: { fontSize: 14, lineHeight: 21, color: theme.bad },
  empty: { fontSize: 14, lineHeight: 21, color: theme.muted, paddingVertical: 20 },
});
