import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArchiveReader, type Manifest, type MergedMessage } from "@chatvault/core";
import { getCryptoProvider } from "../../lib/crypto/expo-crypto-provider";
import { WrongPassphraseError } from "../../lib/crypto/key-wrapping";
import { loadArchiveKey, storageFor, unlockWithPassphrase } from "../../lib/archive/vault";
import { formatCount, formatDateTime, formatRange } from "../../lib/ui/format";
import { radius, theme } from "../../lib/ui/theme";
import { MessageRow } from "./MessageRow";

/**
 * A7 — reading an archive back.
 *
 * The counterpart of the Verify screen: Verify says what was captured, this shows it. Between
 * them they are the entire evidence a user has that deleting the original was safe, so this
 * one loads from the archive itself every time rather than from anything cached in memory.
 *
 * An archive whose key is not in the Keychain lands on the passphrase prompt instead. That is
 * a normal state, not an error — a restored backup or a new phone reaches it — and it is the
 * reason the passphrase path must never be allowed to rot (`apps/mobile/CLAUDE.md`).
 */

type State =
  | { readonly kind: "loading" }
  | { readonly kind: "locked"; readonly error?: string }
  | { readonly kind: "unlocking" }
  | {
      readonly kind: "ready";
      readonly manifest: Manifest;
      readonly messages: readonly MergedMessage[];
      readonly reader: ArchiveReader;
    }
  | { readonly kind: "error"; readonly message: string };

export default function ArchiveScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const archiveId = params.id ?? "";

  const [state, setState] = useState<State>({ kind: "loading" });
  const [passphrase, setPassphrase] = useState("");

  const openWith = useCallback(
    async (key: Uint8Array): Promise<void> => {
      const reader = await ArchiveReader.open({
        crypto: getCryptoProvider(),
        storage: storageFor(archiveId),
        key,
        archiveId,
      });
      const messages = await reader.readAll();
      setState({ kind: "ready", manifest: reader.manifest, messages, reader });
    },
    [archiveId],
  );

  useEffect(() => {
    let stale = false;

    void (async () => {
      try {
        const key = await loadArchiveKey(archiveId);
        if (stale) return;
        if (key === null) {
          setState({ kind: "locked" });
          return;
        }
        await openWith(key);
      } catch (error) {
        if (stale) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      stale = true;
    };
  }, [archiveId, openWith]);

  const unlock = useCallback(async (): Promise<void> => {
    setState({ kind: "unlocking" });
    try {
      await openWith(await unlockWithPassphrase(archiveId, passphrase));
    } catch (error) {
      setState({
        kind: "locked",
        error:
          error instanceof WrongPassphraseError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error),
      });
    }
  }, [archiveId, openWith, passphrase]);

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
          onSubmitEditing={() => void unlock()}
        />
        {state.error !== undefined && <Text style={styles.fieldError}>{state.error}</Text>}
        <Pressable
          onPress={() => void unlock()}
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

  return (
    <>
      <Stack.Screen options={{ title: state.manifest.chatTitle }} />
      <FlatList
        data={state.messages}
        keyExtractor={(message) => message.id}
        renderItem={({ item }) => <MessageRow message={item} reader={state.reader} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ArchiveHeaderCard manifest={state.manifest} />}
        // The list is virtualized by default; these keep a long chat's memory bounded while
        // leaving enough rendered that scrolling does not show blanks.
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={11}
        removeClippedSubviews
      />
    </>
  );
}

function ArchiveHeaderCard({ manifest }: { manifest: Manifest }) {
  return (
    <View style={styles.headerCard}>
      <Text style={styles.headerMeta}>
        {formatCount(manifest.messageCount)} messages · {formatRange(manifest.firstTs, manifest.lastTs)}
      </Text>
      <Text style={styles.headerMeta}>
        {manifest.participants.map((p) => p.displayName).join(", ")}
      </Text>
      <Text style={styles.headerFoot}>
        {formatCount(manifest.media.length)} media files · updated{" "}
        {formatDateTime(manifest.updatedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  form: { padding: 24, gap: 12 },
  list: { padding: 16, paddingBottom: 40, gap: 10 },
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
  headerCard: {
    padding: 14,
    marginBottom: 8,
    gap: 3,
    borderRadius: radius.card,
    backgroundColor: theme.panel,
  },
  headerMeta: { fontSize: 13, color: theme.body },
  headerFoot: { fontSize: 12, color: theme.muted, marginTop: 2 },
});
