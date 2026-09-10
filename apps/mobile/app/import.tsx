import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  completeImport,
  prepareImport,
  type PreparedImport,
} from "../lib/import/device-import";
import { setImportSession } from "../lib/import/session";
import { WeakPassphraseError, WrongPassphraseError } from "../lib/crypto/key-wrapping";
import { formatBytes, formatCount } from "../lib/ui/format";
import { radius, theme } from "../lib/ui/theme";

/**
 * A4 — import. The screen a share lands on.
 *
 * Two phases, because the question worth asking depends on what the file turns out to be
 * (`device-import.ts`). Phase one reads and parses and matches, and writes nothing; only then
 * does this screen know whether to ask for a new passphrase, ask for an existing one, or get
 * on with it.
 *
 * The copy here is careful about one thing throughout: nothing has happened to the chat in
 * WhatsApp, and nothing ever will (root CLAUDE.md, invariant 1). Every failure message says so
 * explicitly, because a user who has just been told "import failed" is entitled to know their
 * chat is still where they left it.
 */

type Phase =
  | { readonly kind: "reading" }
  | { readonly kind: "asking"; readonly prepared: PreparedImport }
  | { readonly kind: "writing"; readonly prepared: PreparedImport }
  | { readonly kind: "error"; readonly message: string; readonly detail?: string };

export default function ImportScreen() {
  const params = useLocalSearchParams<{
    path?: string;
    fileName?: string;
    mimeType?: string;
    size?: string;
  }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>({ kind: "reading" });
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const write = useCallback(
    async (prepared: PreparedImport, secret: string | undefined): Promise<void> => {
      setPhase({ kind: "writing", prepared });
      try {
        const { outcome, archiveId } = await completeImport(prepared, secret);
        if (cancelled.current) return;

        setImportSession({
          outcome,
          archiveId,
          chatTitle: prepared.chatTitle,
          passphraseSet: prepared.creating,
        });
        router.replace("/verify");
      } catch (error) {
        if (cancelled.current) return;
        setPhase({
          kind: "error",
          message:
            error instanceof WrongPassphraseError
              ? "That passphrase does not open this archive."
              : "The import did not finish.",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [router],
  );

  useEffect(() => {
    let stale = false;

    async function run(): Promise<void> {
      try {
        if (!params.path) throw new Error("No file arrived with the share.");
        const prepared = await prepareImport({
          path: params.path,
          ...(params.fileName !== undefined ? { fileName: params.fileName } : {}),
          ...(params.mimeType !== undefined ? { mimeType: params.mimeType } : {}),
        });
        if (stale || cancelled.current) return;

        // Nothing to ask: an archive this phone already holds the key for.
        if (prepared.requirement === "ready") {
          void write(prepared, undefined);
          return;
        }
        setPhase({ kind: "asking", prepared });
      } catch (error) {
        if (stale || cancelled.current) return;
        setPhase({
          kind: "error",
          message: "This export could not be read.",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    void run();
    return () => {
      stale = true;
    };
  }, [params.path, params.fileName, params.mimeType, write]);

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {phase.kind === "reading" && (
        <Working label="Reading the export..." {...noteProp(fileNote(params.fileName, params.size))} />
      )}

      {phase.kind === "writing" && (
        <Working
          label={phase.prepared.creating ? "Building the archive..." : "Merging into your archive..."}
          note={`${formatCount(phase.prepared.parsed.messages.length)} messages parsed. Encrypting on this device.`}
        />
      )}

      {phase.kind === "asking" && (
        <PassphrasePrompt
          prepared={phase.prepared}
          passphrase={passphrase}
          confirmation={confirmation}
          onPassphrase={setPassphrase}
          onConfirmation={setConfirmation}
          onSubmit={() => void write(phase.prepared, passphrase)}
        />
      )}

      {phase.kind === "error" && (
        <View style={styles.block}>
          <Text style={styles.errorHeading}>{phase.message}</Text>
          {phase.detail !== undefined && (
            <Text style={styles.errorDetail} selectable>
              {phase.detail}
            </Text>
          )}
          <Text style={styles.reassurance}>
            Nothing was changed in WhatsApp. Your chat is exactly where it was — this app never
            touches it.
          </Text>
          <Button label="Back to library" onPress={goBack} />
        </View>
      )}
    </ScrollView>
  );
}

function PassphrasePrompt({
  prepared,
  passphrase,
  confirmation,
  onPassphrase,
  onConfirmation,
  onSubmit,
}: {
  prepared: PreparedImport;
  passphrase: string;
  confirmation: string;
  onPassphrase: (value: string) => void;
  onConfirmation: (value: string) => void;
  onSubmit: () => void;
}) {
  const creating = prepared.creating;
  const tooShort = passphrase.length > 0 && passphrase.length < 8;
  const mismatch = creating && confirmation.length > 0 && confirmation !== passphrase;
  const ready = creating
    ? passphrase.length >= 8 && confirmation === passphrase
    : passphrase.length > 0;

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>
        {creating ? "Choose a passphrase" : `Unlock ${prepared.chatTitle}`}
      </Text>

      <Text style={styles.body}>
        {creating
          ? "This archive is encrypted on this phone before it is written. The passphrase is " +
            "the only way back into it — from this phone, from a new phone, or from the web " +
            "viewer in a browser."
          : "This export belongs to an archive already on this phone, but its key is not in " +
            "this phone's keychain. Your passphrase opens it."}
      </Text>

      {creating && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            We cannot reset it and we cannot recover it. Nobody holds a copy — that is what
            makes the archive yours. Write it down somewhere safe before you continue.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Passphrase</Text>
      <TextInput
        value={passphrase}
        onChangeText={onPassphrase}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        placeholder="At least 8 characters"
        placeholderTextColor={theme.muted}
        accessibilityLabel="Passphrase"
      />
      {tooShort && <Text style={styles.fieldError}>{new WeakPassphraseError().message}</Text>}

      {creating && (
        <>
          <Text style={styles.label}>Type it again</Text>
          <TextInput
            value={confirmation}
            onChangeText={onConfirmation}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            accessibilityLabel="Confirm passphrase"
          />
          {mismatch && <Text style={styles.fieldError}>These do not match.</Text>}
        </>
      )}

      <Summary prepared={prepared} />

      <Button
        label={creating ? "Create the archive" : "Unlock and merge"}
        onPress={onSubmit}
        disabled={!ready}
      />
    </View>
  );
}

function Summary({ prepared }: { prepared: PreparedImport }) {
  const messages = prepared.parsed.messages.length;
  return (
    <View style={styles.summary}>
      <Row label="Chat" value={prepared.chatTitle} />
      <Row label="In this export" value={`${formatCount(messages)} messages`} />
      <Row label="File" value={formatBytes(prepared.byteLength)} />
      {!prepared.creating && (
        <Row label="Already archived" value={`${formatCount(prepared.overlap)} of them`} />
      )}
    </View>
  );
}

function Working({ label, note }: { label: string; note?: string }) {
  return (
    <View style={styles.block}>
      <View style={styles.workingRow}>
        <ActivityIndicator />
        <Text style={styles.heading}>{label}</Text>
      </View>
      {note !== undefined && <Text style={styles.body}>{note}</Text>}
      <Text style={styles.reassurance}>
        Everything happens on this phone. Nothing is uploaded.
      </Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

/** `exactOptionalPropertyTypes` draws a real distinction between "absent" and "undefined". */
function noteProp(note: string | undefined): { note?: string } {
  return note === undefined ? {} : { note };
}

function fileNote(fileName?: string, size?: string): string | undefined {
  const bytes = Number(size ?? 0);
  if (!fileName) return undefined;
  return bytes > 0 ? `${fileName} — ${formatBytes(bytes)}` : fileName;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 4 },
  block: { gap: 12, paddingVertical: 8 },
  heading: { fontSize: 22, fontWeight: "600", color: theme.ink, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, color: theme.body },
  reassurance: { fontSize: 13, lineHeight: 20, color: theme.muted, marginTop: 4 },
  label: { fontSize: 13, fontWeight: "600", color: theme.muted, marginTop: 8 },
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
  fieldError: { fontSize: 13, color: theme.bad, lineHeight: 19 },
  warning: {
    backgroundColor: theme.panel,
    borderRadius: radius.card,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: theme.caution,
  },
  warningText: { fontSize: 14, lineHeight: 21, color: theme.body },
  summary: {
    marginTop: 16,
    backgroundColor: theme.panel,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 14, color: theme.muted },
  rowValue: { fontSize: 14, fontWeight: "500", color: theme.ink, flexShrink: 1, textAlign: "right" },
  workingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  errorHeading: { fontSize: 20, fontWeight: "600", color: theme.bad },
  errorDetail: { fontSize: 14, lineHeight: 21, color: theme.body },
  button: {
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: radius.card,
    alignItems: "center",
    backgroundColor: theme.ink,
  },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.35 },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: theme.paper },
});
