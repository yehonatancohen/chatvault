import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ArchiveReader } from "@chatvault/core";
import { readPreferences } from "../../../lib/archive/preferences";
import { useArchive } from "../../../components/archive/useArchive";
import { buildChatRows, daySeparatorLabel, forInvertedList, type ChatRow } from "../../../lib/ui/chat";
import { formatCount } from "../../../lib/ui/format";
import { summarizeParticipants } from "../../../lib/ui/participants";
import { radius, theme } from "../../../lib/ui/theme";
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
        <Stack.Screen options={{ title: "Archive" }} />
        <ActivityIndicator />
        <Text style={styles.body}>
          {state.kind === "unlocking" ? "Deriving the key..." : "Opening..."}
        </Text>
      </View>
    );
  }

  if (state.kind === "locked") {
    return (
      <View style={styles.form}>
        <Stack.Screen options={{ title: "Locked" }} />
        <Text style={styles.heading}>This archive is locked</Text>
        <Text style={styles.body}>
          Its key is not in this phone's keychain — normal after a restore, a reinstall, or if
          the archive came from another device. Your passphrase opens it, and puts the key back.
        </Text>
        <TextInput
          value={passphrase}
          onChangeText={setPassphrase}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          placeholder="Passphrase"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Passphrase"
          onSubmitEditing={() => void unlock(passphrase)}
        />
        {state.error !== undefined && <Text style={styles.fieldError}>{state.error}</Text>}
        <Pressable
          onPress={() => void unlock(passphrase)}
          disabled={passphrase.length === 0}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            passphrase.length === 0 && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.buttonLabel}>Unlock</Text>
        </Pressable>
      </View>
    );
  }

  if (state.kind === "error") {
    return (
      <View style={styles.form}>
        <Stack.Screen options={{ title: "Archive" }} />
        <Text style={styles.headingBad}>This archive did not open</Text>
        <Text style={styles.body} selectable>
          {state.message}
        </Text>
        <Text style={styles.body}>
          If you have not deleted this chat in WhatsApp yet, do not delete it.
        </Text>
        <Pressable
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Back to library</Text>
        </Pressable>
      </View>
    );
  }

  const people = summarizeParticipants(state.manifest.participants.map((p) => p.displayName));

  return (
    <View style={styles.chat}>
      <Stack.Screen
        options={{
          title: state.manifest.chatTitle,
          headerRight: () => (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/archive/[id]/info", params: { id: archiveId } })
              }
              accessibilityRole="button"
              accessibilityLabel="Chat information"
              style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
            >
              <Text style={styles.infoButtonLabel}>Info</Text>
            </Pressable>
          ),
        }}
      />

      {/* A one-line stand-in for the avatar row a messaging app puts under the title. */}
      <Pressable
        onPress={() => router.push({ pathname: "/archive/[id]/info", params: { id: archiveId } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.subheader, pressed && styles.pressed]}
      >
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
              The beginning of this archive · {formatCount(state.messages.length)} messages
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
  if (row.kind === "day") {
    return (
      <View style={styles.dayRow}>
        <Text style={styles.dayLabel}>{daySeparatorLabel(row.ts)}</Text>
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

const styles = StyleSheet.create({
  chat: { flex: 1, backgroundColor: "#f2efe9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  form: { padding: 24, gap: 12 },
  list: { paddingVertical: 10 },
  heading: { fontSize: 22, fontWeight: "600", color: theme.ink },
  headingBad: { fontSize: 22, fontWeight: "600", color: theme.bad },
  body: { fontSize: 15, lineHeight: 22, color: theme.body },
  input: {
    borderWidth: 1,
    borderColor: theme.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.ink,
    backgroundColor: "#fff",
  },
  fieldError: { fontSize: 13, color: theme.bad },
  button: {
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: radius.card,
    alignItems: "center",
    backgroundColor: theme.ink,
  },
  buttonDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: theme.paper },
  infoButton: { paddingHorizontal: 8, paddingVertical: 4 },
  infoButtonLabel: { fontSize: 16, color: theme.ink, fontWeight: "500" },
  subheader: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: theme.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.hairline,
  },
  subheaderText: { fontSize: 12.5, color: theme.muted },
  dayRow: { alignItems: "center", paddingVertical: 10 },
  dayLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: theme.muted,
    backgroundColor: theme.paper,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.chip,
    overflow: "hidden",
  },
  beginning: { alignItems: "center", paddingVertical: 18, paddingHorizontal: 40 },
  beginningText: { fontSize: 11.5, color: theme.muted, textAlign: "center" },
});
