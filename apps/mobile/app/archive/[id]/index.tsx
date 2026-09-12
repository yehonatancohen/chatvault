import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ArchiveReader } from "@chatvault/core";
import { readPreferences } from "../../../lib/archive/preferences";
import { useArchive } from "../../../components/archive/useArchive";
import {
  buildChatRows,
  daySeparatorLabel,
  forInvertedList,
  type ChatRow,
} from "../../../lib/ui/chat";
import { createStyles, useApp } from "../../../components/app/providers";
import { Actions, Body, Button, Field, Screen, Title } from "../../../components/app/ui";
import { formatCount, formatRange } from "../../../lib/ui/format";
import { summarizeParticipants } from "../../../lib/ui/participants";
import { gutter, radius, space, type } from "../../../lib/ui/theme";
import { MessageBubble } from "../../../components/archive/MessageBubble";
import { Lightbox, type LightboxSubject } from "../../../components/archive/Lightbox";

/**
 * A7 — reading an archive back, as a chat.
 *
 * The counterpart of the Verify screen: Verify says what was captured, this shows it. Between
 * them they are the entire evidence a user has that deleting the original was safe, so this
 * loads from the archive itself every time rather than from anything cached in memory.
 *
 * **The list is inverted.** A conversation ends at the bottom, and a reader arriving at an
 * archive of their own chat wants the last thing that was said, not the first. Inverting is
 * preferred over scrolling to the end after layout, which shows the oldest message for a frame
 * first — see `forInvertedList`.
 *
 * An archive whose key is not in the Keychain lands on the passphrase prompt instead. That is a
 * normal state, not an error — a restored backup or a new phone reaches it — and it is the
 * reason the passphrase path must never be allowed to rot (`apps/mobile/CLAUDE.md`).
 */

export default function ArchiveChatScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const archiveId = params.id ?? "";

  const { t, tp, language } = useApp();
  const styles = useStyles();

  const { state, unlock } = useArchive(archiveId);
  const [passphrase, setPassphrase] = useState("");
  const [selfId, setSelfId] = useState<string | undefined>(undefined);
  const [lightbox, setLightbox] = useState<LightboxSubject | undefined>(undefined);

  // Re-read on focus so choosing "this is me" in the info screen is reflected on return.
  useFocusEffect(
    useCallback(() => {
      let stale = false;
      void (async () => {
        const preferences = await readPreferences(archiveId);
        if (!stale) setSelfId(preferences.selfParticipantId);
      })();
      return () => {
        stale = true;
      };
    }, [archiveId]),
  );

  const rows = useMemo(
    () => (state.kind === "ready" ? forInvertedList(buildChatRows(state.messages)) : []),
    [state],
  );

  if (state.kind === "loading" || state.kind === "unlocking") {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t("reader.title") }} />
        <ActivityIndicator />
        <Text style={styles.centeredLabel}>
          {state.kind === "unlocking" ? t("reader.deriving") : t("reader.opening")}
        </Text>
      </View>
    );
  }

  if (state.kind === "locked") {
    return (
      <Screen keyboard>
        <Stack.Screen options={{ title: t("reader.locked.title") }} />
        <Title text={t("reader.locked.heading")} note={t("reader.locked.body")} />
        <Field
          secure
          value={passphrase}
          onChange={setPassphrase}
          placeholder={t("import.field.passphrase")}
          error={state.error}
          onSubmit={() => void unlock(passphrase)}
        />
        <Actions>
          <Button
            label={t("reader.locked.unlock")}
            onPress={() => void unlock(passphrase)}
            disabled={passphrase.length === 0}
          />
        </Actions>
      </Screen>
    );
  }

  if (state.kind === "error") {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("reader.title") }} />
        {/* The warning is the subtitle: someone whose archive did not open needs to be told
            not to delete the original before they read anything else. */}
        <Title text={t("reader.error.heading")} note={t("reader.error.warning")} />
        <Body muted>{state.message}</Body>
        <Actions>
          <Button label={t("common.backToLibrary")} onPress={() => router.replace("/")} />
        </Actions>
      </Screen>
    );
  }

  const people = summarizeParticipants(
    state.manifest.participants.map((p) => p.displayName),
    undefined,
    language,
  );

  const openInfo = (): void => {
    router.push({ pathname: "/archive/[id]/info", params: { id: archiveId } });
  };

  return (
    <View style={styles.chat}>
      <Stack.Screen
        options={{
          title: state.manifest.chatTitle,
          headerRight: () => (
            <Pressable
              onPress={openInfo}
              accessibilityRole="button"
              accessibilityLabel={t("reader.infoLabel")}
              style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
            >
              <Text style={styles.infoButtonLabel}>{t("reader.info")}</Text>
            </Pressable>
          ),
        }}
      />

      {/*
        The stand-in for the avatar row a messaging app puts under the title. The archive's own
        numbers go here — how much of the chat this is — because the reader is evidence, and the
        count is part of the claim.
      */}
      <Pressable
        onPress={openInfo}
        accessibilityRole="button"
        style={({ pressed }) => [styles.subheader, pressed && styles.pressed]}
      >
        <Text style={styles.subheaderStats} numberOfLines={1}>
          <Text style={styles.subheaderStrong}>{formatCount(state.messages.length)}</Text>{" "}
          {t("verify.row.messages")}
          {"  ·  "}
          <Text style={styles.subheaderStrong}>
            {formatCount(state.manifest.media.length)}
          </Text>{" "}
          {t("verify.row.mediaFiles")}
          {"  ·  "}
          {formatRange(state.manifest.firstTs, state.manifest.lastTs)}
        </Text>
        <Text style={styles.subheaderText} numberOfLines={1}>
          {people.label}
        </Text>
      </Pressable>

      <FlatList
        data={rows}
        inverted
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => (
          <Row row={item} reader={state.reader} selfId={selfId} onOpenMedia={setLightbox} />
        )}
        contentContainerStyle={styles.list}
        // The archive's *first* message sits at the visual top, so the footer of an inverted
        // list is where "this is the beginning" belongs.
        ListFooterComponent={
          <View style={styles.beginning}>
            <Text style={styles.beginningText}>
              {t("reader.beginning", {
                messages: tp("common.messages", state.messages.length),
              })}
            </Text>
          </View>
        }
        initialNumToRender={18}
        maxToRenderPerBatch={16}
        windowSize={11}
        removeClippedSubviews
      />

      <Lightbox subject={lightbox} onClose={() => setLightbox(undefined)} />
    </View>
  );
}

function Row({
  row,
  reader,
  selfId,
  onOpenMedia,
}: {
  row: ChatRow;
  reader: ArchiveReader;
  selfId: string | undefined;
  onOpenMedia: (subject: LightboxSubject) => void;
}) {
  const { language } = useApp();
  const styles = useStyles();

  if (row.kind === "day") {
    return (
      <View style={styles.dayRow}>
        <Text style={styles.dayLabel}>{daySeparatorLabel(row.ts, Date.now(), language)}</Text>
      </View>
    );
  }

  return (
    <MessageBubble
      message={row.message}
      reader={reader}
      startsGroup={row.startsGroup}
      endsGroup={row.endsGroup}
      // `Manifest.participants[].id` is the sender's display name as written by the export —
      // `buildImport` sets both from the same string, because nothing in a WhatsApp export
      // gives a member a stabler identity than that. If aliases ever become real ids, this
      // comparison has to go through the participant list instead.
      isSelf={selfId !== undefined && row.message.sender === selfId}
      onOpenMedia={onOpenMedia}
    />
  );
}

const useStyles = createStyles((t) => ({
  chat: { flex: 1, backgroundColor: t.paper },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  centeredLabel: { ...type.caption, color: t.muted, writingDirection: "auto" },
  list: { paddingVertical: space.md },
  pressed: { opacity: 0.6 },
  infoButton: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  infoButtonLabel: { ...type.label, color: t.accent },
  subheader: {
    paddingHorizontal: gutter,
    paddingVertical: space.sm + 2,
    gap: 2,
    backgroundColor: t.panel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.hairline,
  },
  subheaderStats: { ...type.micro, fontWeight: "400", color: t.muted, writingDirection: "auto" },
  subheaderStrong: { color: t.ink, fontWeight: "700" },
  subheaderText: { ...type.micro, fontWeight: "400", color: t.faint, writingDirection: "auto" },
  dayRow: { alignItems: "center", paddingVertical: space.md },
  dayLabel: {
    ...type.micro,
    color: t.muted,
    backgroundColor: t.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  beginning: { alignItems: "center", paddingVertical: space.xl, paddingHorizontal: space.xxl },
  beginningText: { ...type.micro, fontWeight: "400", color: t.faint, textAlign: "center" },
}));
