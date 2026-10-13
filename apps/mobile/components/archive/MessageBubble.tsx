import { memo, useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  describeMessage,
  displayFilename,
  formatText,
  type ArchiveReader,
  type MediaType,
  type MergedMessage,
  type MessageView,
} from "@chatvault/core";
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
 * Four things make this read like a conversation rather than a table, and each is a rule
 * rather than a decoration:
 *
 * - **What a message *is* comes from `describeMessage` in core**, the same reading the website
 *   uses. An export flattens a poll, a place, a call or an edit into lines of text; this draws
 *   them as what they were. Nothing here inspects `message.body` on its own.
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

  const view = describeMessage(message);

  if (view.type === "notice") {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{view.text}</Text>
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

        {view.type === "text" && <Rich text={view.text} isSelf={isSelf} />}

        {view.type === "media" &&
          (view.filename !== undefined && message.attachment?.sha256 !== undefined ? (
            <Attachment
              reader={reader}
              sha256={message.attachment.sha256}
              filename={view.filename}
              media={view.media}
              title={view.title}
              detail={view.detail}
              sender={message.sender}
              ts={message.ts}
              onOpen={onOpenMedia}
            />
          ) : (
            <NotHere
              label={
                (view.title !== undefined ? `${view.title} · ` : "") +
                t(view.filename !== undefined ? "bubble.notInExport" : "bubble.omitted")
              }
            />
          ))}
        {view.type === "media" && view.caption.length > 0 && <Rich text={view.caption} isSelf={isSelf} />}

        {view.type === "deleted" && (
          <Text style={[styles.deleted, isSelf && styles.deletedSelf]}>{t("bubble.deleted")}</Text>
        )}

        {view.type === "unavailable" && <NotHere label={t("bubble.unavailable")} />}

        {view.type === "location" && (
          <View style={styles.card}>
            <Text style={[styles.cardKind, isSelf && styles.timeSelf]}>
              {t(view.live ? "bubble.liveLocation" : "bubble.location")}
            </Text>
            {view.label !== undefined && (
              <Text style={[styles.cardTitle, isSelf && styles.bodySelf]}>{view.label}</Text>
            )}
            {view.url !== undefined ? (
              // A link the reader chooses to follow. No map is drawn here, so nothing about the
              // chat reaches a map service by scrolling past it.
              <Text
                accessibilityRole="link"
                onPress={() => openLink(view.url)}
                style={isSelf ? styles.linkSelf : styles.link}
              >
                {t("bubble.openMaps")}
              </Text>
            ) : (
              <Text style={[styles.cardKind, isSelf && styles.timeSelf]}>{t("bubble.liveLocationEnded")}</Text>
            )}
          </View>
        )}

        {view.type === "poll" && <Poll view={view} isSelf={isSelf} />}

        {view.type === "call" && (
          <Text style={[styles.body, isSelf && styles.bodySelf, view.missed && !isSelf && styles.missed]}>
            {t(callKey(view))}
          </Text>
        )}

        <View style={styles.meta}>
          {view.edited && <Text style={[styles.time, isSelf && styles.timeSelf]}>{t("bubble.edited")}</Text>}
          <Text style={[styles.time, isSelf && styles.timeSelf]}>{messageTime(message.ts)}</Text>
        </View>
      </View>
    </View>
  );
});

type CallView = Extract<MessageView, { type: "call" }>;

function callKey(view: CallView) {
  if (view.missed) {
    if (view.group) return view.video ? "bubble.call.missedGroupVideo" : "bubble.call.missedGroupVoice";
    return view.video ? "bubble.call.missedVideo" : "bubble.call.missedVoice";
  }
  if (view.group) return view.video ? "bubble.call.groupVideo" : "bubble.call.groupVoice";
  return view.video ? "bubble.call.video" : "bubble.call.voice";
}

function openLink(url: string | undefined): void {
  if (url === undefined) return;
  // `formatText` and `describeMessage` only ever hand back http(s) links.
  void Linking.openURL(url).catch(() => undefined);
}

/** Text the way WhatsApp sets it: its emphasis marks applied, its links followable. */
function Rich({ text, isSelf }: { text: string; isSelf: boolean }) {
  const styles = useStyles();
  return (
    <Text style={[styles.body, isSelf && styles.bodySelf]} selectable>
      {formatText(text).map((span, index) =>
        span.href !== undefined ? (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => openLink(span.href)}
            style={isSelf ? styles.linkSelf : styles.link}
          >
            {span.text}
          </Text>
        ) : (
          <Text
            key={index}
            style={[
              span.bold && styles.bold,
              span.italic && styles.italic,
              span.strike && styles.strike,
              span.code && styles.code,
            ]}
          >
            {span.text}
          </Text>
        ),
      )}
    </Text>
  );
}

function Poll({ view, isSelf }: { view: Extract<MessageView, { type: "poll" }>; isSelf: boolean }) {
  const { t } = useApp();
  const styles = useStyles();
  const most = Math.max(1, ...view.options.map((option) => option.votes ?? 0));
  return (
    <View style={styles.card}>
      <Text style={[styles.cardKind, isSelf && styles.timeSelf]}>{t("bubble.poll")}</Text>
      <Text style={[styles.cardTitle, isSelf && styles.bodySelf]}>{view.question}</Text>
      {view.options.map((option, index) => (
        <View key={index} style={styles.pollOption}>
          <View style={styles.pollRow}>
            <Text style={[styles.pollText, isSelf && styles.bodySelf]}>{option.text}</Text>
            {option.votes !== null && (
              <Text style={[styles.cardKind, isSelf && styles.timeSelf]}>{option.votes}</Text>
            )}
          </View>
          <View style={styles.pollTrack}>
            <View
              style={[
                styles.pollFill,
                isSelf && styles.pollFillSelf,
                { width: `${((option.votes ?? 0) / most) * 100}%` },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

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
  media,
  title,
  detail,
  sender,
  ts,
  onOpen,
}: {
  reader: ArchiveReader;
  sha256: string;
  filename: string;
  /** What WhatsApp called it: the only thing that tells a sticker from a photo. */
  media: MediaType;
  title: string | undefined;
  detail: string | undefined;
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
          {media === "contact"
            ? t("bubble.kind.contact")
            : media === "gif"
              ? t("bubble.kind.gif")
              : kind === "video"
                ? t("bubble.kind.video")
                : kind === "audio"
                  ? t("bubble.kind.audio")
                  : media === "document"
                    ? t("bubble.kind.document")
                    : t("bubble.kind.file")}
        </Text>
        <Text style={styles.fileChipName} numberOfLines={1}>
          {title ?? displayFilename(filename)}
        </Text>
        {detail !== undefined && <Text style={styles.fileChipNote}>{detail}</Text>}
        {(kind === "video" || kind === "audio") && (
          <Text style={styles.fileChipNote}>{t("bubble.notPlayable")}</Text>
        )}
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
      <Image
        source={{ uri }}
        style={media === "sticker" ? styles.sticker : styles.image}
        resizeMode={media === "sticker" ? "contain" : "cover"}
      />
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
  // Messages' own pair: a grey bubble for everyone else, the tint with white type for the
  // reader (who is whichever participant they marked as themselves in chat info).
  bubbleOther: { backgroundColor: t.bubble },
  bubbleSelf: { backgroundColor: t.selfBubble },
  // Squared on the side the run ends against. The logical properties mirror under RTL, which
  // is what keeps the tail on the speaker's side in a Hebrew chat rather than across from it.
  tailOther: { borderStartStartRadius: BUBBLE_RADIUS, borderEndStartRadius: 5 },
  tailSelf: { borderEndEndRadius: 5 },
  sender: { ...type.micro, fontWeight: "600", writingDirection: "auto" },
  body: { ...type.body, color: t.ink, writingDirection: "auto" },
  bodySelf: { color: t.onSelfBubble },
  time: { ...type.micro, fontSize: 11, lineHeight: 13, color: t.muted, alignSelf: "flex-end" },
  timeSelf: { color: t.onSelfBubbleMuted },
  meta: { flexDirection: "row", justifyContent: "flex-end", alignItems: "baseline", gap: 6 },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  strike: { textDecorationLine: "line-through" },
  code: { fontFamily: "Courier" },
  link: { color: t.accent, textDecorationLine: "underline" },
  linkSelf: { color: t.onSelfBubble, textDecorationLine: "underline" },
  missed: { color: t.bad },
  card: { gap: 4, minWidth: 190 },
  cardKind: { ...type.micro, color: t.muted, writingDirection: "auto" },
  cardTitle: { ...type.body, fontWeight: "600", color: t.ink, writingDirection: "auto" },
  pollOption: { gap: 3 },
  pollRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  pollText: { ...type.body, color: t.ink, writingDirection: "auto", flexShrink: 1 },
  pollTrack: { height: 5, borderRadius: 3, backgroundColor: t.hairline, overflow: "hidden" },
  pollFill: { height: 5, borderRadius: 3, backgroundColor: t.accent },
  pollFillSelf: { backgroundColor: t.onSelfBubble },
  sticker: { width: 132, height: 132 },
  deleted: { ...type.body, fontStyle: "italic", color: t.muted, writingDirection: "auto" },
  deletedSelf: { color: t.onSelfBubbleMuted },
  systemRow: { paddingVertical: space.sm, paddingHorizontal: space.xxxl, alignItems: "center" },
  // Plain centred secondary text, the way Messages sets a transcript's own notices.
  systemText: { ...type.micro, color: t.muted, textAlign: "center", writingDirection: "auto" },
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
    backgroundColor: t.raised,
    minWidth: 180,
  },
  fileChipKind: { ...type.micro, color: t.muted, writingDirection: "auto" },
  fileChipName: { ...type.caption, color: t.ink },
  fileChipNote: { ...type.micro, color: t.faint, writingDirection: "auto" },
  notHere: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: t.hairline,
    backgroundColor: t.raised,
    maxWidth: 240,
  },
  // Solid and coloured only for a photo that failed its content-address check — a real fault.
  // Media WhatsApp simply left out of the export keeps the dashed neutral outline.
  notHereBad: { borderColor: t.bad, borderStyle: "solid" },
  notHereText: { ...type.micro, color: t.muted, writingDirection: "auto" },
  notHereTextBad: { color: t.bad },
}));
