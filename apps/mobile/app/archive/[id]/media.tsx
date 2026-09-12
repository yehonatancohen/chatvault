import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useArchive } from "../../../components/archive/useArchive";
import { useChatPhoto } from "../../../components/archive/useChatPhoto";
import { MediaTile } from "../../../components/archive/MediaGrid";
import { Lightbox, type LightboxSubject } from "../../../components/archive/Lightbox";
import { buildMediaIndex, imagesOnly, type MediaItem } from "../../../lib/ui/media-index";
import { createStyles, useApp } from "../../../components/app/providers";
import { formatBytes, formatCount, formatDate } from "../../../lib/ui/format";
import { gutter, space, type } from "../../../lib/ui/theme";

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
  const { lightboxAction } = useChatPhoto(params.id ?? "");
  const { t, tp } = useApp();
  const styles = useStyles();
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
        <Stack.Screen options={{ title: t("media.title") }} />
        {state.kind === "error" ? (
          <Text style={styles.error} selectable>
            {state.message}
          </Text>
        ) : state.kind === "locked" ? (
          <Text style={styles.body}>{t("info.locked")}</Text>
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
      <Stack.Screen
        options={{ title: t("media.titleCount", { count: formatCount(images.length) }) }}
      />

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
            {/* Keeps the last, partial row aligned to the start rather than stretched. */}
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
              {t("media.header", {
                photos: tp("media.photos", images.length),
                size: formatBytes(totalBytes),
              })}
            </Text>
            {otherKinds > 0 && (
              <Text style={styles.headerNote}>{tp("media.otherKinds", otherKinds)}</Text>
            )}
            {images.length > 0 && (
              <Text style={styles.headerNote}>
                {formatDate(images[images.length - 1]!.ts)} — {formatDate(images[0]!.ts)}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t("media.empty")}</Text>}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />

      <Lightbox
        subject={lightbox}
        onClose={() => setLightbox(undefined)}
        action={lightboxAction(lightbox)}
      />
    </View>
  );
}

function chunk(items: readonly MediaItem[], size: number): MediaItem[][] {
  const rows: MediaItem[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const useStyles = createStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.paper },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: gutter,
    gap: space.md,
  },
  list: { padding: space.md, paddingBottom: space.xxxl },
  row: { flexDirection: "row" },
  filler: { width: `${100 / COLUMNS}%` },
  header: { paddingHorizontal: space.md, paddingBottom: space.lg, gap: space.xs },
  headerText: { ...type.caption, color: t.body, writingDirection: "auto" },
  headerNote: { ...type.caption, color: t.muted, writingDirection: "auto" },
  body: { ...type.body, color: t.body, textAlign: "center", writingDirection: "auto" },
  error: { ...type.caption, color: t.muted, writingDirection: "auto" },
  empty: { ...type.body, color: t.muted, padding: space.xl, textAlign: "center", writingDirection: "auto" },
}));
