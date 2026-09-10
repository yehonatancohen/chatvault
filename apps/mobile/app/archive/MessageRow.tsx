import { memo, useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import type { ArchiveReader, MergedMessage } from "@chatvault/core";
import { toBase64 } from "../../lib/crypto/base64";
import { mediaKindOf, mimeTypeOf } from "../../lib/ui/mime";
import { formatDateTime } from "../../lib/ui/format";
import { radius, theme } from "../../lib/ui/theme";

/**
 * One message.
 *
 * **RTL is handled by the text engine, not by us.** `writingDirection: "auto"` makes each
 * message take its direction from its own first strong character, which is the only approach
 * that survives a chat where Hebrew and English alternate line by line — the common case in
 * the real export this project is built against. It is the React Native counterpart of the
 * web viewer's `unicodeBidi: "plaintext"` (`apps/web/CLAUDE.md`). Never replace it with a
 * language guess over the whole conversation.
 *
 * **A message whose media is not in the archive says so.** `omitted-media` and an attachment
 * with no `sha256` both mean "this photo is not here" — the first because WhatsApp left it out
 * of the export, the second because the export named a file it did not contain. Rendering
 * either as an ordinary empty message would quietly misrepresent what the archive holds, on
 * the screen a user opens to check exactly that.
 */

export const MessageRow = memo(function MessageRow({
  message,
  reader,
}: {
  message: MergedMessage;
  reader: ArchiveReader;
}) {
  if (message.kind === "system") {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>
          {message.body}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <Text style={styles.sender}>
          {message.sender ?? "Unknown"}
        </Text>
        <Text style={styles.time}>{formatDateTime(message.ts)}</Text>
      </View>

      {message.kind === "attachment" && message.attachment?.sha256 !== undefined ? (
        <Attachment
          reader={reader}
          sha256={message.attachment.sha256}
          filename={message.attachment.filename}
        />
      ) : null}

      {message.kind === "attachment" && message.attachment?.sha256 === undefined && (
        <NotCaptured label="This file was named in the chat but was not in the export." />
      )}

      {message.kind === "omitted-media" && (
        <NotCaptured label="WhatsApp left this media out of the export — it is not in the archive." />
      )}

      {message.kind === "deleted" && <Text style={styles.deleted}>This message was deleted</Text>}

      {message.body.length > 0 && (
        <Text style={styles.body} selectable>
          {message.body}
        </Text>
      )}
    </View>
  );
});

/**
 * Decrypts one blob and shows it.
 *
 * The bytes become a `data:` URI rather than a file on disk, and that is a deliberate cost:
 * writing a decrypted copy into the cache directory to get a `file://` URI would leave
 * plaintext media sitting outside the archive, which is the one thing the encryption is for.
 * The price is that a large photo is held in memory as base64 while it is on screen. If that
 * becomes a problem, the fix is a thumbnail written *into the archive* at import time, not a
 * plaintext cache.
 *
 * Fetching is triggered by mount — `FlatList` only mounts rows near the viewport, so scrolling
 * past a hundred photos does not decrypt a hundred photos.
 */
function Attachment({
  reader,
  sha256,
  filename,
}: {
  reader: ArchiveReader;
  sha256: string;
  filename: string;
}) {
  const [uri, setUri] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState<string | undefined>(undefined);
  const kind = mediaKindOf(filename);

  useEffect(() => {
    if (kind !== "image") return;
    let stale = false;

    void (async () => {
      try {
        const bytes = await reader.readMedia(sha256);
        if (stale) return;
        setUri(`data:${mimeTypeOf(filename)};base64,${toBase64(bytes)}`);
      } catch (error) {
        if (stale) return;
        // `readMedia` verifies the blob against its own content address, so a failure here is
        // a real integrity problem and worth showing rather than rendering a blank box.
        setFailed(error instanceof Error ? error.message : String(error));
      }
    })();

    return () => {
      stale = true;
    };
  }, [reader, sha256, filename, kind]);

  if (kind !== "image") {
    return (
      <View style={styles.fileChip}>
        <Text style={styles.fileChipText} numberOfLines={1}>
          {kind === "video" ? "Video" : kind === "audio" ? "Audio" : "File"} · {filename}
        </Text>
        <Text style={styles.fileChipNote}>In the archive. Not playable here yet.</Text>
      </View>
    );
  }

  if (failed !== undefined) {
    return <NotCaptured label={`This image did not decrypt: ${failed}`} bad />;
  }

  if (uri === undefined) {
    return (
      <View style={styles.imagePlaceholder}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Image source={{ uri }} style={styles.image} resizeMode="cover" accessibilityLabel={filename} />;
}

function NotCaptured({ label, bad }: { label: string; bad?: boolean }) {
  return (
    <View style={[styles.notCaptured, bad === true && styles.notCapturedBad]}>
      <Text style={[styles.notCapturedText, bad === true && styles.notCapturedTextBad]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: 12,
    gap: 6,
    borderRadius: radius.card,
    backgroundColor: theme.panel,
  },
  meta: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  sender: { fontSize: 13, fontWeight: "600", color: theme.ink, flexShrink: 1, writingDirection: "auto" },
  time: { fontSize: 12, color: theme.muted },
  body: { fontSize: 15, lineHeight: 22, color: theme.body, writingDirection: "auto" },
  deleted: { fontSize: 14, fontStyle: "italic", color: theme.muted },
  systemRow: { paddingVertical: 6, paddingHorizontal: 12, alignItems: "center" },
  systemText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.muted,
    textAlign: "center",
    writingDirection: "auto",
  },
  image: { width: "100%", height: 220, borderRadius: radius.chip, backgroundColor: theme.hairline },
  imagePlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: radius.chip,
    backgroundColor: theme.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  fileChip: {
    padding: 10,
    gap: 2,
    borderRadius: radius.chip,
    backgroundColor: theme.paper,
    borderWidth: 1,
    borderColor: theme.hairline,
  },
  fileChipText: { fontSize: 13, fontWeight: "500", color: theme.ink },
  fileChipNote: { fontSize: 12, color: theme.muted },
  notCaptured: {
    padding: 10,
    borderRadius: radius.chip,
    backgroundColor: theme.paper,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.hairline,
  },
  notCapturedBad: { borderColor: theme.bad, borderStyle: "solid" },
  notCapturedText: { fontSize: 12, lineHeight: 18, color: theme.muted },
  notCapturedTextBad: { color: theme.bad },
});
