import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { ArchiveReader } from "@chatvault/core";
import { toBase64 } from "../../lib/crypto/base64";
import { mimeTypeOf } from "../../lib/ui/mime";
import { initialsFor } from "../../lib/ui/media-index";
import { colorForParticipant } from "../../lib/ui/participants";
import type { MediaItem } from "../../lib/ui/media-index";

/**
 * The circle beside a chat in the library.
 *
 * A WhatsApp export contains no contact photos — there is no avatar anywhere in the data — so
 * the chat's own media is the only real image available, and initials are the fallback for a
 * chat that has none. That is also what WhatsApp itself shows for a contact without a picture,
 * so the fallback is not a compromise so much as the same convention.
 *
 * **Initials render immediately and the photo replaces them when it arrives.** Decrypting even
 * a small blob is work, and the library must not wait on it: the list should be usable the
 * instant it opens, with the thumbnails filling in. `pickChatThumbnail` deliberately chooses
 * the *smallest* image for this reason.
 *
 * Decrypted images are cached for the process. A user moving between the library and a chat
 * would otherwise pay for the same decryption repeatedly, and the bytes are already in memory
 * elsewhere while the app runs.
 */

const cache = new Map<string, string>();

export function ChatAvatar({
  archiveId,
  title,
  reader,
  thumbnail,
  size = 52,
}: {
  archiveId: string;
  title: string;
  reader: ArchiveReader | undefined;
  thumbnail: MediaItem | undefined;
  size?: number;
}) {
  const [uri, setUri] = useState<string | undefined>(() => cache.get(archiveId));

  useEffect(() => {
    if (uri !== undefined || reader === undefined || thumbnail === undefined) return;
    let stale = false;

    void (async () => {
      try {
        const bytes = await reader.readMedia(thumbnail.sha256);
        if (stale) return;
        const dataUri = `data:${mimeTypeOf(thumbnail.filename)};base64,${toBase64(bytes)}`;
        cache.set(archiveId, dataUri);
        setUri(dataUri);
      } catch {
        // A chat with an unreadable thumbnail still deserves a row; the initials stay, and the
        // library's own "unreadable" state is what reports a genuinely broken archive.
      }
    })();

    return () => {
      stale = true;
    };
  }, [archiveId, reader, thumbnail, uri]);

  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (uri !== undefined) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, dimensions]}
        resizeMode="cover"
        accessibilityLabel={`${title} photo`}
      />
    );
  }

  return (
    <View style={[styles.fallback, dimensions, { backgroundColor: colorForParticipant(title) }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsFor(title)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: "#ddd9d1" },
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontWeight: "700" },
});
