import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Directory, Paths } from "expo-file-system";
import { runStorageContract, type ContractResult } from "@chatvault/storage";
import { ExpoFileSystemStorageAdapter } from "../lib/storage/expo-file-system-adapter";

/**
 * A1 — the storage contract, run on the device. Dev-only; this must never ship.
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
 */

/** One directory per case. The contract hands each case a *fresh, empty* adapter. */
const ROOT_NAME = "storage-contract";

function slugify(caseName: string): string {
  return caseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type Run =
  | { readonly status: "idle" }
  | { readonly status: "running" }
  | { readonly status: "done"; readonly results: readonly ContractResult[] }
  | { readonly status: "error"; readonly message: string };

export default function DevStorageScreen() {
  const [run, setRun] = useState<Run>({ status: "idle" });

  const start = useCallback(async (): Promise<void> => {
    setRun({ status: "running" });
    const root = new Directory(Paths.cache, ROOT_NAME);
    try {
      // Start from nothing: a previous run's files would make "lists nothing before anything
      // is written" pass or fail for reasons that have nothing to do with the adapter.
      if (root.exists) root.delete();

      const results = await runStorageContract((caseName) => {
        const caseRoot = new Directory(root, slugify(caseName));
        // Deliberately not created here — the adapter must cope with a root that does not yet
        // exist, which is exactly the state a brand-new archive starts in.
        return new ExpoFileSystemStorageAdapter(caseRoot);
      });

      setRun({ status: "done", results });
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

  const results = run.status === "done" ? run.results : [];
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const passed = results.filter((r) => r.status === "passed").length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.body}>
        Runs <Text style={styles.mono}>storageContract</Text> against{" "}
        <Text style={styles.mono}>ExpoFileSystemStorageAdapter</Text> — the same cases{" "}
        <Text style={styles.mono}>pnpm test</Text> runs against the in-memory adapter, which
        cannot reach this one because the filesystem here is a native module.
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
          {run.status === "done" ? "Run again" : "Run the contract"}
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
                ? "The device adapter satisfies the same contract as the in-memory one."
                : "Do not write an archive through this adapter until these pass."}
            </Text>
          </View>

          {results.map((result) => (
            <View key={result.name} style={styles.result}>
              <Text style={styles.resultLine}>
                <Text style={statusStyle(result.status)}>{statusMark(result.status)}</Text>{" "}
                {result.name}
              </Text>
              {result.detail !== undefined && (
                <Text style={styles.detail} selectable>
                  {result.detail}
                </Text>
              )}
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

function statusStyle(status: ContractResult["status"]) {
  if (status === "passed") return styles.pass;
  if (status === "failed") return styles.fail;
  return styles.skip;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 4 },
  body: { fontSize: 15, lineHeight: 22, color: "#4a4842" },
  mono: { fontFamily: "Menlo", fontSize: 13 },
  button: {
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#1c1b19",
  },
  buttonPressed: { opacity: 0.7 },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: "#faf9f6" },
  working: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  summaryBox: { paddingVertical: 16, gap: 4 },
  passHeading: { fontSize: 20, fontWeight: "600", color: "#256d4a" },
  failHeading: { fontSize: 20, fontWeight: "600", color: "#a3341f" },
  result: {
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd9d1",
  },
  resultLine: { fontSize: 14, lineHeight: 20, color: "#1c1b19" },
  pass: { fontFamily: "Menlo", fontSize: 12, color: "#256d4a" },
  fail: { fontFamily: "Menlo", fontSize: 12, color: "#a3341f" },
  skip: { fontFamily: "Menlo", fontSize: 12, color: "#6b6862" },
  detail: { fontSize: 13, lineHeight: 19, color: "#a3341f", fontFamily: "Menlo" },
});
