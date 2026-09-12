import { memo, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ArchiveReader, MergedMessage } from "@chatvault/core";
import { mediaKindOf } from "../../lib/ui/mime";
import { messageTime } from "../../lib/ui/chat";
import { colorForParticipant } from "../../lib/ui/participants";
import { createStyles, useApp } from "../app/providers";
import { radius, space, type } from "../../lib/ui/theme";
import type { LightboxSubject } from "./Lightbox";
import { fullUri, previewUri } from "../../lib/ui/media-uri";

/**
 * One message, as a chat bubble.
 *
 * Three things make this read like a conversation rather than a table, and each is a rule
 * rather than a decoration:
 *
 * - **RTL comes from the text engine.** `writingDirection: "auto"` gives every message its own
 *   direction from its own first strong character. The chats this project is built against
 *   alternate Hebrew and English line by line, so a per-conversation language guess is wrong on
 *   half the messages. It is the React Native counterpart of the web viewer's
 *   `unicodeBidi: "plaintext"` — never replace it with a heuristic.
 * - **A name appears once per run**, not on every line (`buildChatRows` decides), and keeps a
 *   stable colour so a speaker is recognisable while scrolling.
 * - **Media the archive does not hold says so, in place.** An `omitted-media` message and an
 *   attachment with no `sha256` both mean "the file is not here". Rendering either as an empty
 *   bubble would misrepresent the archive on the screen someone opens to check it.
 */

export const MessageBubble = memo(function MessageBubble({
  message,
  reader,
  startsGroup,
  endsGroup,
  isSelf,
  onOpenMedia,
}: {
  message: MergedMessage;
  reader: ArchiveReader;
  startsGroup: boolean;
  endsGroup: boolean;
  isSelf: boolean;
  onOpenMedia: (subject: LightboxSubject) => void;
}) {
  const { t } = useApp();
  const styles = useStyles();

  if (message.kind === "system") {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.body}</Text>
      </View>
    );
  }

  const sender = message.sender ?? t("common.unknown");
  const showName = startsGroup && !isSelf;

  return (
    <View
      style={[
        styles.row,
        isSelf ? styles.rowSelf : styles.rowOther,
        endsGroup ? styles.rowGroupEnd : styles.rowGrouped,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isSelf ? styles.bubbleSelf : styles.bubbleOther,
          // The tail corner is squared only on the last bubble of a run, which is what makes a
          // stack of messages read as one turn.
          endsGroup && (isSelf ? styles.tailSelf : styles.tailOther),
        ]}
      >
        {showName && (
          <Text style={[styles.sender, { color: colorForParticipant(sender) }]}>{sender}</Text>
        )}

        {message.kind === "attachment" && message.attachment?.sha256 !== undefined && (
          <Attachment
            reader={reader}
            sha256={message.attachment.sha256}
            filename={message.attachment.filename}
            sender={message.sender}
            ts={message.ts}
            onOpen={onOpenMedia}
          />
        )}

        {message.kind === "attachment" && message.attachment?.sha256 === undefined && (
          <NotHere label={t("bubble.notInExport")} />
        )}

        {message.kind === "omitted-media" && (
          <NotHere label={t("bubble.omitted")} />
        )}

        {message.kind === "deleted" && (
          <Text style={styles.deleted}>{t("bubble.deleted")}</Text>
        )}

        {message.body.length > 0 && (
          <Text style={styles.body} selectable>
            {message.body}
          </Text>
        )}

        <Text style={[styles.time, isSelf && styles.timeSelf]}>{messageTime(message.ts)}</Text>
      </View>
    </View>
  );
});

/**
 * Decrypts one blob and shows it, tappable.
 *
 * The bytes become a `data:` URI rather than a file on disk: writing a decrypted copy into the
 * cache to get a `file://` URI would leave plaintext media outside the archive, which is the
 * one thing the encryption exists to prevent. The cost is holding the photo as base64 while it
 * is on screen; the fix, if it ever bites, is a thumbnail sealed *into* the archive at import
 * time, never a plaintext cache.
 *
 * Fetching starts on mount, and `FlatList` only mounts rows near the viewport — so scrolling
 * past a hundred photos does not decrypt a hundred photos.
 */
function Attachment({
  reader,
  sha256,
  filename,
  sender,
  ts,
  onOpen,
}: {
  reader: ArchiveReader;
  sha256: string;
  filename: string;
  sender: string | null;
  ts: number;
  onOpen: (subject: LightboxSubject) => void;
}) {
  const { t } = useApp();
  const styles = useStyles();
  const [uri, setUri] = useState<string | undefined>(undefined);
  const [isFull, setIsFull] = useState(true);
  const [failed, setFailed] = useState<string | undefined>(undefined);
  const kind = mediaKindOf(filename);

  useEffect(() => {
    if (kind !== "image") return;
    let stale = false;

    void (async () => {
      try {
        const loaded = await previewUri(reader, sha256, filename);
        if (stale) return;
        setUri(loaded.uri);
        setIsFull(loaded.isFull);
      } catch (error) {
        if (stale) return;
        // Two different things: a photo that came back but does not match its own content
        // address is damaged (worth saying plainly); anything else is almost always Drive being
        // unreachable for a photo the phone no longer keeps — ordinary, and said calmly.
        setFailed(error instanceof Error && error.name === "ArchiveIntegrityError" ? "damaged" : "unreachable");
      }
    })();

    return () => {
      stale = true;
    };
  }, [reader, sha256, filename, kind]);

  if (kind !== "image") {
    return (
      <View style={styles.fileChip}>
        <Text style={styles.fileChipKind}>
          {kind === "video"
            ? t("bubble.kind.video")
            : kind === "audio"
              ? t("bubble.kind.audio")
              : t("bubble.kind.file")}
        </Text>
        <Text style={styles.fileChipName} numberOfLines={1}>
          {filename}
        </Text>
        <Text style={styles.fileChipNote}>{t("bubble.notPlayable")}</Text>
      </View>
    );
  }

  if (failed !== undefined) {
    return failed === "damaged" ? (
      <NotHere label={t("bubble.damaged")} bad />
    ) : (
      <NotHere label={t("bubble.unreachable")} />
    );
  }

  if (uri === undefined) {
    return (
      <View style={styles.imagePlaceholder}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() =>
        onOpen({
          uri,
          filename,
          sender,
          ts,
          sha256,
          ...(isFull ? {} : { resolveFull: () => fullUri(reader, sha256, filename) }),
        })
      }
      accessibilityRole="imagebutton"
      accessibilityLabel={t("bubble.photoFrom", { sender: sender ?? t("common.unknown") })}
      style={({ pressed }) => [styles.imagePress, pressed && styles.pressed]}
    >
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
    </Pressable>
  );
}

function NotHere({ label, bad }: { label: string; bad?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.notHere, bad === true && styles.notHereBad]}>
      <Text style={[styles.notHereText, bad === true && styles.notHereTextBad]}>{label}</Text>
    </View>
  );
}

/** The bubble corner. Named because the tail styles have to square exactly one of them. */
const BUBBLE_RADIUS = 18;

const useStyles = createStyles((t) => ({
  row: { flexDirection: "row", paddingHorizontal: space.md },
  rowSelf: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  rowGrouped: { marginTop: 2 },
  rowGroupEnd: { marginTop: 2, marginBottom: space.sm },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: 6,
    borderRadius: BUBBLE_RADIUS,
    gap: 3,
  },
  // The design leans flatter than a bubble, but self-messages still sit on their own side (the
  // reader stores "which participant is you" for exactly that), so the shape stays and only the
  // fill follows the palette: a wood tint for you, plain raised for others.
  bubbleOther: {
    backgroundColor: t.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
  },
  bubbleSelf: { backgroundColor: t.selfBubble },
  // Squared on the side the run ends against. The logical properties mirror under RTL, which
  // is what keeps the tail on the speaker's side in a Hebrew chat rather than across from it.
  tailOther: { borderStartStartRadius: BUBBLE_RADIUS, borderEndStartRadius: 5 },
  tailSelf: { borderEndEndRadius: 5 },
  sender: { ...type.micro, letterSpacing: 0, writingDirection: "auto" },
  // A shade larger than the app's body step: this is the one screen whose entire purpose is
  // reading, often on an old conversation someone is going through line by line.
  body: { fontSize: 16, lineHeight: 23, color: t.ink, writingDirection: "auto" },
  time: { ...type.micro, fontWeight: "400", letterSpacing: 0, color: t.faint, alignSelf: "flex-end" },
  timeSelf: { color: t.dark ? "#c7a683" : "#8a6a48" },
  deleted: { ...type.body, fontStyle: "italic", color: t.muted, writingDirection: "auto" },
  systemRow: { paddingVertical: space.sm, paddingHorizontal: space.xxxl, alignItems: "center" },
  systemText: {
    ...type.caption,
    color: t.muted,
    textAlign: "center",
    writingDirection: "auto",
    backgroundColor: t.panel,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  imagePress: { borderRadius: radius.chip, overflow: "hidden" },
  pressed: { opacity: 0.85 },
  image: { width: 232, height: 232, backgroundColor: t.sunken },
  imagePlaceholder: {
    width: 232,
    height: 232,
    borderRadius: radius.chip,
    backgroundColor: t.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  fileChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: 2,
    borderRadius: radius.chip,
    backgroundColor: t.panel,
    minWidth: 180,
  },
  fileChipKind: { ...type.micro, color: t.muted, writingDirection: "auto" },
  fileChipName: { ...type.caption, color: t.ink },
  fileChipNote: { ...type.micro, fontWeight: "400", letterSpacing: 0, color: t.faint, writingDirection: "auto" },
  notHere: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: t.hairline,
    backgroundColor: t.panel,
    maxWidth: 240,
  },
  // Solid and coloured only for a photo that failed its content-address check — a real fault.
  // Media WhatsApp simply left out of the export keeps the dashed neutral outline.
  notHereBad: { borderColor: t.bad, borderStyle: "solid" },
  notHereText: { ...type.micro, fontWeight: "400", letterSpacing: 0, color: t.muted, writingDirection: "auto" },
  notHereTextBad: { color: t.bad },
}));
