import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  completeImport,
  prepareImport,
  type PreparedImport,
} from "../lib/import/device-import";
import type { ImportStage } from "../lib/import/run-import";
import { setImportSession } from "../lib/import/session";
import { WrongPassphraseError } from "../lib/crypto/key-wrapping";
import { createStyles, useApp } from "../components/app/providers";
import { Button, Callout, CalloutText, Row } from "../components/app/ui";
import { formatBytes, formatCount } from "../lib/ui/format";
import { radius, space } from "../lib/ui/theme";
import type { StringKey } from "../lib/i18n/strings";

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

/**
 * Deliberately plain: a stuck import should tell the user which step it is stuck on.
 *
 * The key is computed from the stage, which is the one place in the app that reaches the
 * catalogue with something other than a literal — hence the cast, and hence `translate`
 * returning the key rather than throwing when one is missing.
 */
function stageKey(stage: ImportStage): StringKey {
  return `import.stage.${stage}` as StringKey;
}

type Phase =
  | { readonly kind: "reading" }
  | { readonly kind: "asking"; readonly prepared: PreparedImport }
  | {
      readonly kind: "writing";
      readonly prepared: PreparedImport;
      readonly stage: ImportStage;
    }
  | { readonly kind: "error"; readonly message: string; readonly detail?: string };

export default function ImportScreen() {
  const params = useLocalSearchParams<{
    path?: string;
    fileName?: string;
    mimeType?: string;
    size?: string;
  }>();
  const router = useRouter();
  const { t } = useApp();
  const styles = useStyles();

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
      setPhase({ kind: "writing", prepared, stage: "parsing" });
      try {
        const { outcome, archiveId } = await completeImport(prepared, secret, (stage) => {
          if (!cancelled.current) setPhase({ kind: "writing", prepared, stage });
        });
        if (cancelled.current) return;

        setImportSession({
          outcome,
          archiveId,
          chatTitle: prepared.chatTitle,
          passphraseSet: prepared.creating,
          hadMedia: prepared.hadMedia,
        });
        router.replace("/verify");
      } catch (error) {
        if (cancelled.current) return;
        setPhase({
          kind: "error",
          message:
            error instanceof WrongPassphraseError
              ? t("import.error.wrongPassphrase")
              : t("import.error.unfinished"),
          // The stage is included because "it failed" is not a usable report and this is the
          // one screen where a failure is expensive to reproduce.
          detail: `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
        });
      }
    },
    [router, t],
  );

  useEffect(() => {
    let stale = false;

    async function run(): Promise<void> {
      try {
        if (!params.path) throw new Error(t("import.error.noFile"));
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
          message: t("import.error.unreadable"),
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    void run();
    return () => {
      stale = true;
    };
  }, [params.path, params.fileName, params.mimeType, write, t]);

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {phase.kind === "reading" && (
        <Working
          label={t("import.reading")}
          {...noteProp(fileNote(params.fileName, params.size))}
        />
      )}

      {phase.kind === "writing" && (
        <Working
          label={t(stageKey(phase.stage))}
          note={
            `${t("import.note.counts", {
              messages: formatCount(phase.prepared.parsed.messages.length),
              size: formatBytes(phase.prepared.byteLength),
            })} ` +
            (phase.stage === "writing"
              ? t("import.note.writing")
              : phase.stage === "deriving-key"
                ? t("import.note.deriving")
                : t("import.note.local"))
          }
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
          <Text style={styles.reassurance}>{t("import.error.reassurance")}</Text>
          <Button label={t("common.backToLibrary")} onPress={goBack} />
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
  const { t, theme } = useApp();
  const styles = useStyles();

  const creating = prepared.creating;
  const tooShort = passphrase.length > 0 && passphrase.length < 8;
  const mismatch = creating && confirmation.length > 0 && confirmation !== passphrase;
  const ready = creating
    ? passphrase.length >= 8 && confirmation === passphrase
    : passphrase.length > 0;

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>
        {creating
          ? t("import.choose.heading")
          : t("import.unlock.heading", { chat: prepared.chatTitle })}
      </Text>

      <Text style={styles.body}>
        {creating ? t("import.choose.body") : t("import.unlock.body")}
      </Text>

      {creating && (
        <Callout tone="caution">
          <CalloutText>{t("import.choose.warning")}</CalloutText>
        </Callout>
      )}

      <Text style={styles.label}>{t("import.field.passphrase")}</Text>
      <TextInput
        value={passphrase}
        onChangeText={onPassphrase}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        placeholder={t("import.field.placeholder")}
        placeholderTextColor={theme.muted}
        // Without this the system keyboard stays light behind a dark app, which is the single
        // most obvious way a "supports dark mode" claim falls apart.
        keyboardAppearance={theme.dark ? "dark" : "light"}
        accessibilityLabel={t("import.field.passphrase")}
      />
      {tooShort && <Text style={styles.fieldError}>{t("import.field.tooShort")}</Text>}

      {creating && (
        <>
          <Text style={styles.label}>{t("import.field.again")}</Text>
          <TextInput
            value={confirmation}
            onChangeText={onConfirmation}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            keyboardAppearance={theme.dark ? "dark" : "light"}
            accessibilityLabel={t("import.field.confirm")}
          />
          {mismatch && <Text style={styles.fieldError}>{t("import.field.mismatch")}</Text>}
        </>
      )}

      <Summary prepared={prepared} />

      <Button
        label={creating ? t("import.submit.create") : t("import.submit.merge")}
        onPress={onSubmit}
        disabled={!ready}
      />
    </View>
  );
}

function Summary({ prepared }: { prepared: PreparedImport }) {
  const { t, tp } = useApp();
  const styles = useStyles();

  return (
    <View style={styles.summary}>
      <Row label={t("import.summary.chat")} value={prepared.chatTitle} />
      <Row
        label={t("import.summary.inExport")}
        value={tp("common.messages", prepared.parsed.messages.length)}
      />
      <Row label={t("import.summary.file")} value={formatBytes(prepared.byteLength)} />
      {!prepared.creating && (
        <Row
          label={t("import.summary.alreadyArchived")}
          value={t("import.summary.alreadyArchivedValue", {
            count: formatCount(prepared.overlap),
          })}
        />
      )}
    </View>
  );
}

function Working({ label, note }: { label: string; note?: string }) {
  const { t } = useApp();
  const styles = useStyles();

  return (
    <View style={styles.block}>
      <View style={styles.workingRow}>
        <ActivityIndicator />
        <Text style={styles.heading}>{label}</Text>
      </View>
      {note !== undefined && <Text style={styles.body}>{note}</Text>}
      <Text style={styles.reassurance}>{t("import.onThisPhone")}</Text>
    </View>
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

const useStyles = createStyles((t) => ({
  container: { padding: space.xl, gap: space.xs },
  block: { gap: space.md, paddingVertical: space.sm },
  heading: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: t.ink,
    letterSpacing: -0.3,
    writingDirection: "auto",
  },
  body: { fontSize: 15, lineHeight: 22, color: t.body, writingDirection: "auto" },
  reassurance: {
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: space.xs,
    writingDirection: "auto",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: t.muted,
    marginTop: space.sm,
    writingDirection: "auto",
  },
  input: {
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 16,
    color: t.ink,
    backgroundColor: t.field,
    // A passphrase is never RTL text and mirroring the caret makes it feel broken while typing.
    textAlign: "left",
    writingDirection: "ltr",
  },
  fieldError: { fontSize: 13, color: t.bad, lineHeight: 19, writingDirection: "auto" },
  summary: {
    marginTop: space.lg,
    backgroundColor: t.panel,
    borderRadius: radius.card,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.xs,
  },
  workingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  errorHeading: { fontSize: 20, fontWeight: "700", color: t.bad, writingDirection: "auto" },
  errorDetail: { fontSize: 14, lineHeight: 21, color: t.body },
}));
