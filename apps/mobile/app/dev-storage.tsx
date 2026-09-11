import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Directory, Paths } from "expo-file-system";
import {
  runLiveDriveContract,
  runStorageContract,
  type ContractResult,
} from "@chatvault/storage";
import { createDriveClient, type AccessTokenProvider } from "../lib/drive/drive-storage";
import { googleAccessToken, restoreGoogleConnection } from "../lib/drive/google-auth";
import { ExpoFileSystemStorageAdapter } from "../lib/storage/expo-file-system-adapter";
import { runPipelineChecks } from "../lib/dev/pipeline-check";
import { createStyles } from "../components/app/providers";

/**
 * The device checks. Dev-only; this must never ship.
 *
 * Two suites, for the same reason: both cover code whose real runtime is a phone, and neither
 * can run in CI.
 *
 * `packages/storage/CLAUDE.md` makes the conformance suite non-optional for every adapter, and
 * `ExpoFileSystemStorageAdapter` is the one adapter that cannot run it under vitest:
 * `File`/`Directory` are a native module, absent from Node, so `pnpm test` proves nothing about
 * it and `pnpm typecheck` proves only that it compiles. This screen is the missing runner. It
 * executes the same cases (`packages/storage/src/contract.ts`) that `pnpm test` runs against
 * `MemoryStorageAdapter`, inside the Expo runtime, and renders every result.
 *
 * Until this screen shows green on a real device, the adapter is unverified, and A4's import
 * pipeline would be writing a user's only copy of a chat through untested code.
 *
 * It runs against the cache directory rather than the App Group container: the contract is
 * about filesystem semantics, which do not differ between the two, and a failed run should
 * never leave debris next to real archives.
 *
 * **The pipeline checks** (`lib/dev/pipeline-check.ts`) do the same job for A3 and A4. The
 * Node suite proves the import pipeline against WebCrypto and an in-memory store; on a phone
 * the crypto is `@noble` under Hermes, the hashing is a native module, and the storage is a
 * filesystem. These run the real thing, and compare Hermes' AES-GCM and PBKDF2 output against
 * fixed vectors produced by WebCrypto — which is what makes "an archive written here opens in
 * a browser" a checked claim rather than a hope.
 */

/** One directory per case. The contract hands each case a *fresh, empty* adapter. */
const ROOT_NAME = "storage-contract";

function slugify(caseName: string): string {
  return caseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface Suite {
  readonly title: string;
  readonly results: readonly ContractResult[];
}

type Run =
  | { readonly status: "idle" }
  | { readonly status: "running" }
  | { readonly status: "done"; readonly suites: readonly Suite[] }
  | { readonly status: "error"; readonly message: string };

export default function DevStorageScreen() {
  const styles = useStyles();
  const [run, setRun] = useState<Run>({ status: "idle" });
  const [driveToken, setDriveToken] = useState("");

  const start = useCallback(async (): Promise<void> => {
    setRun({ status: "running" });
    const root = new Directory(Paths.cache, ROOT_NAME);
    try {
      // Start from nothing: a previous run's files would make "lists nothing before anything
      // is written" pass or fail for reasons that have nothing to do with the adapter.
      if (root.exists) root.delete();

      const storageResults = await runStorageContract((caseName) => {
        const caseRoot = new Directory(root, slugify(caseName));
        // Deliberately not created here — the adapter must cope with a root that does not yet
        // exist, which is exactly the state a brand-new archive starts in.
        return new ExpoFileSystemStorageAdapter(caseRoot);
      });
      const pipelineResults = await runPipelineChecks();

      setRun({
        status: "done",
        suites: [
          { title: "Storage contract", results: storageResults },
          { title: "Crypto and import pipeline", results: pipelineResults },
        ],
      });
    } catch (error) {
      setRun({ status: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      try {
        if (root.exists) root.delete();
      } catch {
        // Cleanup failure is not a contract failure; the cache directory is the system's to reap.
      }
    }
  }, []);

  /**
   * The storage contract against the user's real Google Drive, through `expo/fetch`.
   *
   * Separate from the button above because it needs a token and a network, and because it is
   * checking something different: not this phone's filesystem but how this phone's HTTP stack
   * talks to Drive — in particular whether it hands back Drive's `308 Resume Incomplete` during
   * a chunked upload instead of treating it as a redirect. The token is the Google account
   * connected on the Account tab, or one pasted from https://developers.google.com/oauthplayground
   * (scope `drive.file`). Either way, **use a throwaway account**. A pasted token is held in
   * memory for this screen only.
   */
  const startDrive = useCallback(async (): Promise<void> => {
    const token = driveToken.trim();
    setRun({ status: "running" });
    try {
      // A pasted token wins; otherwise the Google account connected on the Account tab — which
      // should be a throwaway one for this run, since it writes and trashes test folders.
      let getToken: AccessTokenProvider = () => Promise.resolve(token);
      if (token === "") {
        const connection = await restoreGoogleConnection();
        if (connection === null || !connection.hasDrive) {
          throw new Error("No token pasted and no Google Drive connected on the Account tab.");
        }
        getToken = googleAccessToken;
      }
      const client = createDriveClient(getToken);
      const results = await runLiveDriveContract(client);
      setRun({ status: "done", suites: [{ title: "Storage contract — Google Drive", results }] });
    } catch (error) {
      setRun({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, [driveToken]);

  const results = run.status === "done" ? run.suites.flatMap((suite) => suite.results) : [];
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const passed = results.filter((r) => r.status === "passed").length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.body}>
        Runs everything <Text style={styles.mono}>pnpm test</Text> cannot: the storage contract
        against the real filesystem adapter, and the crypto and import pipeline against Hermes,
        the native SHA-256 and a real directory — including whether this phone's AES-GCM and
        PBKDF2 produce the exact bytes a browser does.
      </Text>

      <Pressable
        onPress={() => void start()}
        accessibilityRole="button"
        disabled={run.status === "running"}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          run.status === "running" && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonLabel}>
          {run.status === "done" ? "Run again" : "Run the device checks"}
        </Text>
      </Pressable>

      <Text style={styles.suiteTitle}>Google Drive (real, throwaway account)</Text>
      <TextInput
        value={driveToken}
        onChangeText={setDriveToken}
        placeholder="Optional: paste a drive.file access token"
        placeholderTextColor="#999"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={styles.input}
      />
      <Pressable
        onPress={() => void startDrive()}
        accessibilityRole="button"
        disabled={run.status === "running"}
        style={({ pressed }) => [
          styles.button,
          styles.buttonTight,
          (pressed || run.status === "running") && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonLabel}>
          {driveToken.trim() === "" ? "Run against the connected Drive" : "Run with pasted token"}
        </Text>
      </Pressable>

      {run.status === "running" && (
        <View style={styles.working}>
          <ActivityIndicator />
          <Text style={styles.body}>Running...</Text>
        </View>
      )}

      {run.status === "error" && (
        <View style={styles.summaryBox}>
          <Text style={styles.failHeading}>The run itself failed</Text>
          <Text style={styles.detail} selectable>
            {run.message}
          </Text>
        </View>
      )}

      {run.status === "done" && (
        <>
          <View style={styles.summaryBox}>
            <Text style={failed === 0 ? styles.passHeading : styles.failHeading}>
              {failed === 0
                ? `${passed} passed${skipped > 0 ? `, ${skipped} skipped` : ""}`
                : `${failed} failed, ${passed} passed`}
            </Text>
            <Text style={styles.body}>
              {failed === 0
                ? "This device behaves the way the Node suites say it should — including " +
                  "producing byte-identical crypto to the web viewer."
                : "Do not trust an archive written by this build until these pass."}
            </Text>
          </View>

          {run.suites.map((suite) => (
            <View key={suite.title}>
              <Text style={styles.suiteTitle}>{suite.title}</Text>
              {suite.results.map((result) => (
                <View key={result.name} style={styles.result}>
                  <Text style={styles.resultLine}>
                    <Text style={statusStyle(styles, result.status)}>{statusMark(result.status)}</Text>{" "}
                    {result.name}
                  </Text>
                  {result.detail !== undefined && (
                    <Text
                      style={result.status === "passed" ? styles.note : styles.detail}
                      selectable
                    >
                      {result.detail}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function statusMark(status: ContractResult["status"]): string {
  if (status === "passed") return "PASS";
  if (status === "failed") return "FAIL";
  return "SKIP";
}

/**
 * Takes the sheet rather than closing over one: `useStyles` is a hook and this is called from
 * inside a `map`, so the styles have to arrive as an argument.
 */
function statusStyle(styles: ReturnType<typeof useStyles>, status: ContractResult["status"]) {
  if (status === "passed") return styles.pass;
  if (status === "failed") return styles.fail;
  return styles.skip;
}

// Themed but deliberately not translated: this screen never ships, and its output is check
// names that only exist in English anyway. Theming it is not polish — without it the whole
// screen is dark text on the dark palette's ground and unreadable exactly when a device bug is
// being chased.
const useStyles = createStyles((t) => ({
  container: { padding: 24, gap: 4 },
  body: { fontSize: 15, lineHeight: 22, color: t.body },
  mono: { fontFamily: "Menlo", fontSize: 13 },
  button: {
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: t.accent,
  },
  buttonPressed: { opacity: 0.7 },
  buttonTight: { marginTop: 8 },
  input: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
    color: t.ink,
    fontFamily: "Menlo",
    fontSize: 12,
  },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: t.onAccent },
  working: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  summaryBox: { paddingVertical: 16, gap: 4 },
  passHeading: { fontSize: 20, fontWeight: "600", color: t.good },
  failHeading: { fontSize: 20, fontWeight: "600", color: t.bad },
  suiteTitle: {
    marginTop: 24,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "700",
    color: t.muted,
  },
  result: {
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.hairline,
  },
  resultLine: { fontSize: 14, lineHeight: 20, color: t.ink },
  pass: { fontFamily: "Menlo", fontSize: 12, color: t.good },
  fail: { fontFamily: "Menlo", fontSize: 12, color: t.bad },
  skip: { fontFamily: "Menlo", fontSize: 12, color: t.muted },
  detail: { fontSize: 13, lineHeight: 19, color: t.bad, fontFamily: "Menlo" },
  /** A measurement reported by a passing check reads as information, not as an error. */
  note: { fontSize: 13, lineHeight: 19, color: t.muted, fontFamily: "Menlo" },
}));
