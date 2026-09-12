import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
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
import {
  Actions,
  Body,
  Button,
  Field,
  Screen,
  Section,
  SwitchRow,
  Title,
} from "../components/app/ui";
import { formatBytes } from "../lib/ui/format";
import { space, type } from "../lib/ui/theme";
import type { StringKey } from "../lib/i18n/strings";

/**
 * A4 — import. The screen a share lands on.
 *
 * Two phases, because the question worth asking depends on what the file turns out to be
 * (`device-import.ts`). Phase one reads and parses and matches, and writes nothing. Then: a new
 * chat gets a one-tap Save (with an optional "Protect with a passphrase" switch — encryption is
 * opt-in); a protected chat whose key isn't here asks for its passphrase; anything else just
 * saves.
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
          passphraseSet: prepared.creating && secret !== undefined && secret !== "",
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
          // Kept, small: "it failed" is not a usable report, and this is expensive to reproduce.
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

        // Adding to a chat already here: nothing to ask.
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
    <Screen keyboard>
      {phase.kind === "reading" && <Working label={t("import.reading")} />}

      {phase.kind === "writing" && <Working label={t(stageKey(phase.stage))} />}

      {phase.kind === "asking" &&
        (phase.prepared.requirement === "unlock" ? (
          <UnlockForm prepared={phase.prepared} onSubmit={(secret) => void write(phase.prepared, secret)} />
        ) : (
          <SaveForm prepared={phase.prepared} onSubmit={(secret) => void write(phase.prepared, secret)} />
        ))}

      {phase.kind === "error" && (
        <>
          {/* The reassurance is the subtitle, not a paragraph below the fold: a user reading
              "the import did not finish" needs "nothing changed in WhatsApp" in the same
              glance, not after it. */}
          <Title text={phase.message} note={t("import.error.reassurance")} />
          {phase.detail !== undefined && (
            <Text style={styles.errorDetail} selectable>
              {phase.detail}
            </Text>
          )}
          <Actions>
            <Button label={t("common.backToLibrary")} onPress={goBack} />
          </Actions>
        </>
      )}
    </Screen>
  );
}

/**
 * A new chat: its name, its size, and one switch. Saved plain unless the switch is on — then
 * a passphrase (twice) is asked for. The switch starts where Settings says.
 */
function SaveForm({
  prepared,
  onSubmit,
}: {
  prepared: PreparedImport;
  onSubmit: (passphrase: string | undefined) => void;
}) {
  const { t, tp, settings } = useApp();
  const styles = useStyles();
  const [protect, setProtect] = useState(settings.protectNewChats);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const tooShort = passphrase.length > 0 && passphrase.length < 8;
  const mismatch = confirmation.length > 0 && confirmation !== passphrase;
  const ready = !protect || (passphrase.length >= 8 && confirmation === passphrase);

  return (
    <>
      <Title
        text={prepared.chatTitle}
        note={`${tp("common.messages", prepared.parsed.messages.length)} · ${formatBytes(prepared.byteLength)}`}
      />

      <Section footnote={protect ? t("import.protect.warning") : undefined}>
        <SwitchRow label={t("import.protect")} value={protect} onChange={setProtect} />
      </Section>

      {protect && (
        <View style={styles.fields}>
          <Field
            secure
            value={passphrase}
            onChange={setPassphrase}
            placeholder={t("import.field.passphrase")}
            error={tooShort ? t("import.field.tooShort") : undefined}
          />
          <Field
            secure
            value={confirmation}
            onChange={setConfirmation}
            placeholder={t("import.field.again")}
            error={mismatch ? t("import.field.mismatch") : undefined}
          />
        </View>
      )}

      <Actions>
        <Button label={t("import.save")} onPress={() => onSubmit(protect ? passphrase : undefined)} disabled={!ready} />
      </Actions>
    </>
  );
}

/** Adding to a protected chat whose key isn't on this phone: its passphrase, and nothing else. */
function UnlockForm({
  prepared,
  onSubmit,
}: {
  prepared: PreparedImport;
  onSubmit: (passphrase: string) => void;
}) {
  const { t } = useApp();
  const [passphrase, setPassphrase] = useState("");
  const submit = () => onSubmit(passphrase);

  return (
    <>
      <Title text={t("import.unlock.heading", { chat: prepared.chatTitle })} />
      <Field
        secure
        value={passphrase}
        onChange={setPassphrase}
        placeholder={t("import.field.passphrase")}
        onSubmit={submit}
      />
      <Actions>
        <Button label={t("import.submit.merge")} onPress={submit} disabled={passphrase.length === 0} />
      </Actions>
    </>
  );
}

/** What the import is doing right now. A stuck import must say which step it is stuck on. */
function Working({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.working}>
      <ActivityIndicator />
      <Body>{label}</Body>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  fields: { gap: space.lg },
  working: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xxl,
  },
  // Kept, small, and selectable: "it failed" is not a usable report, and this is expensive to
  // reproduce. It is the one place in the app that shows a user text written for a developer,
  // which is why it is set at the smallest step and never coloured as an error.
  errorDetail: { ...type.caption, color: t.faint },
}));
