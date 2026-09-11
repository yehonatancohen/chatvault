import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import type { ArchiveReader } from "@chatvault/core";
import type { MediaItem } from "../../lib/ui/media-index";
import { createStyles, useApp } from "../app/providers";
import { space } from "../../lib/ui/theme";
import type { LightboxSubject } from "./Lightbox";
import { fullUri, previewUri } from "../../lib/ui/media-uri";

/**
 * A grid of the archive's photos.
 *
 * Each tile decrypts its own blob when it mounts, exactly as a message row does, and for the
 * same reason: the bytes become a `data:` URI rather than a file, so no plaintext copy is ever
 * written outside the archive. A grid makes that cost visible in a way the chat does not — a
 * screenful is nine photos at once instead of two — which is why the tile size is modest and
 * why `MediaScreen` pages through a `FlatList` rather than rendering every photo at once.
 *
 * Tiles draw each photo's small preview (`thumbs/`, made at import and sealed like the rest of
 * a protected archive) and keep the full photo for the lightbox — which after a backup may be
 * in Drive rather than on the phone. A chat without previews falls back to full photos.
 */

export function MediaGrid({
  items,
  reader,
  columns = 3,
  onOpen,
}: {
  items: readonly MediaItem[];
  reader: ArchiveReader;
  columns?: number;
  onOpen: (subject: LightboxSubject) => void;
}) {
  const { t } = useApp();
  const styles = useStyles();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t("media.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <MediaTile
          key={item.sha256}
          item={item}
          reader={reader}
          columns={columns}
          onOpen={onOpen}
        />
      ))}
    </View>
  );
}

export function MediaTile({
  item,
  reader,
  columns,
  onOpen,
}: {
  item: MediaItem;
  reader: ArchiveReader;
  columns: number;
  onOpen: (subject: LightboxSubject) => void;
}) {
  const { t } = useApp();
  const styles = useStyles();
  const [uri, setUri] = useState<string | undefined>(undefined);
  const [isFull, setIsFull] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    void (async () => {
      try {
        // The preview when there is one: small, on the phone, instant.
        const loaded = await previewUri(reader, item.sha256, item.filename);
        if (stale) return;
        setUri(loaded.uri);
        setIsFull(loaded.isFull);
      } catch {
        // `readMedia` verifies the blob against its own address, so a failure is an integrity
        // problem. A tile is too small to explain one; it goes grey and the chat row, which
        // has room, shows the message.
        if (!stale) setFailed(true);
      }
    })();
    return () => {
      stale = true;
    };
  }, [reader, item.sha256, item.filename]);

  const size = `${100 / columns}%` as const;

  return (
    <View style={[styles.cell, { width: size }]}>
      <Pressable
        onPress={() =>
          uri !== undefined &&
          onOpen({
            uri,
            filename: item.filename,
            sender: item.sender,
            ts: item.ts,
            byteLength: item.byteLength,
            sha256: item.sha256,
            ...(isFull ? {} : { resolveFull: () => fullUri(reader, item.sha256, item.filename) }),
          })
        }
        disabled={uri === undefined}
        accessibilityRole="imagebutton"
        accessibilityLabel={t("bubble.photoFrom", {
          sender: item.sender ?? t("common.unknown"),
        })}
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        {uri !== undefined ? (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            {failed ? <Text style={styles.failed}>!</Text> : <ActivityIndicator size="small" />}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -2 },
  cell: { padding: 2 },
  tile: { aspectRatio: 1, borderRadius: 8, overflow: "hidden", backgroundColor: t.hairline },
  pressed: { opacity: 0.8 },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  failed: { fontSize: 18, fontWeight: "700", color: t.bad },
  empty: { paddingVertical: space.lg, paddingHorizontal: space.xs },
  emptyText: { fontSize: 13.5, lineHeight: 20, color: t.muted, writingDirection: "auto" },
}));
