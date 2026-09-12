import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import type { ArchiveReader } from "@chatvault/core";
import { previewUri } from "../../lib/ui/media-uri";
import { initialsFor } from "../../lib/ui/media-index";
import { colorForParticipant } from "../../lib/ui/participants";
import type { MediaItem } from "../../lib/ui/media-index";
import { createStyles } from "../app/providers";

/**
 * The circle that stands for a chat — in the library, and at the top of chat info.
 *
 * A WhatsApp export contains no contact or group photos — there is no avatar anywhere in the
 * data — so this shows initials unless the user has chosen one of the chat's own photos
 * (`ArchivePreferences.chatPhotoSha256`). Initials are also what WhatsApp itself shows for a
 * contact without a picture, so the default is the same convention rather than a compromise.
 *
 * **Initials render immediately and the photo replaces them when it arrives.** Decrypting a
 * blob is work, and the library must not wait on it: the list should be usable the instant it
 * opens, with photos filling in.
 *
 * Decrypted images are cached for the process, keyed by content address — so choosing a new
 * photo shows the new one rather than a stale entry for the chat, and a user moving between the
 * library and a chat does not pay for the same decryption twice.
 */

const cache = new Map<string, string>();

export function ChatAvatar({
  title,
  reader,
  thumbnail,
  size = 52,
}: {
  title: string;
  reader: ArchiveReader | undefined;
  thumbnail: MediaItem | undefined;
  size?: number;
}) {
  const styles = useStyles();
  const sha256 = thumbnail?.sha256;
  // Remembers which photo `uri` belongs to, so a changed choice never shows the previous image.
  const [loaded, setLoaded] = useState<{ sha256: string; uri: string } | undefined>(() =>
    sha256 !== undefined && cache.has(sha256)
      ? { sha256, uri: cache.get(sha256)! }
      : undefined,
  );
  const uri = loaded !== undefined && loaded.sha256 === sha256 ? loaded.uri : undefined;

  useEffect(() => {
    if (reader === undefined || thumbnail === undefined) return;
    const cached = cache.get(thumbnail.sha256);
    if (cached !== undefined) {
      setLoaded({ sha256: thumbnail.sha256, uri: cached });
      return;
    }
    let stale = false;

    void (async () => {
      try {
        const { uri: dataUri } = await previewUri(reader, thumbnail.sha256, thumbnail.filename);
        if (stale) return;
        cache.set(thumbnail.sha256, dataUri);
        setLoaded({ sha256: thumbnail.sha256, uri: dataUri });
      } catch {
        // A chat with an unreadable photo still deserves a row; the initials stay, and the
        // library's own "unreadable" state is what reports a genuinely broken archive.
      }
    })();

    return () => {
      stale = true;
    };
  }, [reader, thumbnail]);

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

const useStyles = createStyles((t) => ({
  // The placeholder tint behind a photo that has not decrypted yet. It has to differ from
  // `paper` in both palettes, or the row looks like it is missing an avatar rather than
  // waiting for one.
  image: { backgroundColor: t.sunken },
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontWeight: "700" },
}));
