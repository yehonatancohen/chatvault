import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { File } from "expo-file-system";
import { parseExport } from "@chatvault/core";

/**
 * Step 0 — proving the handoff.
 *
 * This screen exists to answer one question: can a real WhatsApp export reach our code? It is
 * deliberately not the import pipeline. It reports what arrived, and parses only when doing so
 * is safe.
 *
 * The size guard is the point of the exercise. An export *with media* is a zip that routinely
 * runs to hundreds of megabytes, and reading one into a JS string would kill the process — the
 * same failure the Share Extension's ~120 MB ceiling causes, only moved one step later. So a
 * zip is measured and described, never read. Unzipping belongs to the media pipeline, behind a
 * streaming reader.
 */

/** Above this, do not pull a text file into memory. A text-only export is ~1 MB per 10k msgs. */
const MAX_INLINE_TEXT_BYTES = 25 * 1024 * 1024;

interface ParsedSummary {
  readonly messages: number;
  readonly participants: readonly string[];
  readonly media: number;
  readonly issues: number;
  readonly dialect: string;
  readonly first: string;
  readonly last: string;
}

type Probe =
  | { readonly status: "working" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "done";
      readonly bytes: number;
      readonly parsed?: ParsedSummary;
      readonly note?: string;
    };

export default function ImportScreen() {
  const params = useLocalSearchParams<{
    path?: string;
    fileName?: string;
    mimeType?: string;
    size?: string;
  }>();
  const [probe, setProbe] = useState<Probe>({ status: "working" });
  const router = useRouter();

  /**
   * A share-sheet cold start can land here as the very first screen. `unstable_settings` in
   * `_layout.tsx` gives the stack an anchor so Back usually exists — this is the fallback for
   * when it still does not, so this screen is never a dead end.
   */
  const goToLibrary = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      try {
        if (!params.path) throw new Error("No file path arrived with the share intent.");

        const file = new File(params.path);
        if (!file.exists) {
          throw new Error(
            `The extension handed over ${params.path}, but nothing is there. That usually ` +
              "means the App Group container is not actually shared between the app and the " +
              "extension.",
          );
        }

        const bytes = file.size ?? Number(params.size ?? 0);
        const name = (params.fileName ?? "").toLowerCase();
        const isZip = name.endsWith(".zip") || params.mimeType === "application/zip";

        if (isZip) {
          if (cancelled) return;
          setProbe({
            status: "done",
            bytes,
            note:
              "This is an export with media. The handoff worked — the file is here and its " +
              "size reads correctly. Unzipping is the next milestone, and it must stream " +
              "rather than load the archive whole.",
          });
          return;
        }

        if (bytes > MAX_INLINE_TEXT_BYTES) {
          if (cancelled) return;
          setProbe({
            status: "done",
            bytes,
            note:
              "The handoff worked, but this text export is too large to read in one go. " +
              "Parsing it needs a streaming reader.",
          });
          return;
        }

        const raw = await file.text();
        const result = parseExport(raw);
        const media = result.messages.filter(
          (m) => m.kind === "attachment" || m.kind === "omitted-media",
        ).length;

        if (cancelled) return;
        setProbe({
          status: "done",
          bytes,
          parsed: {
            messages: result.messages.length,
            participants: result.participants,
            media,
            issues: result.issues.length,
            dialect:
              `${result.dialect.platform} - ${result.dialect.dateOrder} - ` +
              `${result.dialect.clock}${result.dialect.hasSeconds ? " - seconds" : ""}`,
            first: result.messages[0]?.wallClock ?? "-",
            last: result.messages[result.messages.length - 1]?.wallClock ?? "-",
          },
        });
      } catch (error) {
        if (cancelled) return;
        setProbe({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [params.path, params.fileName, params.mimeType, params.size]);

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Row label="File" value={params.fileName ?? "-"} />
        <Row label="Type" value={params.mimeType ?? "-"} />

        {probe.status === "working" && (
          <View style={styles.working}>
            <ActivityIndicator />
            <Text style={styles.body}>Reading...</Text>
          </View>
        )}

        {probe.status === "error" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorHeading}>The handoff did not work</Text>
            <Text style={styles.errorBody}>{probe.message}</Text>
          </View>
        )}

        {probe.status === "done" && (
          <>
            <View style={styles.success}>
              <Text style={styles.successHeading}>The file arrived</Text>
              <Text style={styles.body}>{formatBytes(probe.bytes)} on disk.</Text>
            </View>

            {probe.parsed && (
              <>
                <Text style={styles.sectionHeading}>Parsed</Text>
                <Row label="Messages" value={String(probe.parsed.messages)} />
                <Row label="Media" value={String(probe.parsed.media)} />
                <Row
                  label="Participants"
                  value={probe.parsed.participants.join(", ") || "-"}
                />
                <Row label="Range" value={`${probe.parsed.first} to ${probe.parsed.last}`} />
                <Row label="Dialect" value={probe.parsed.dialect} />
                <Row
                  label="Unparsed lines"
                  value={probe.parsed.issues === 0 ? "none" : String(probe.parsed.issues)}
                />
                <Text style={styles.hint}>
                  Compare these against the chat in WhatsApp. If the message count or the date
                  range disagrees, the parser is wrong, and nothing downstream can fix that.
                </Text>
              </>
            )}

            {probe.note !== undefined && <Text style={styles.hint}>{probe.note}</Text>}
          </>
        )}

        {probe.status !== "working" && (
          <Pressable
            onPress={goToLibrary}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>Back to library</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd9d1",
  },
  rowLabel: { fontSize: 14, color: "#6b6862" },
  rowValue: { fontSize: 14, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  sectionHeading: { fontSize: 13, fontWeight: "600", color: "#6b6862", marginTop: 24 },
  body: { fontSize: 15, lineHeight: 22, color: "#4a4842" },
  hint: { fontSize: 13, lineHeight: 20, color: "#6b6862", marginTop: 16 },
  working: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 24 },
  success: { paddingVertical: 20, gap: 4 },
  successHeading: { fontSize: 20, fontWeight: "600", color: "#256d4a" },
  errorBox: { paddingVertical: 20, gap: 8 },
  errorHeading: { fontSize: 18, fontWeight: "600", color: "#a3341f" },
  errorBody: { fontSize: 14, lineHeight: 21, color: "#4a4842" },
  button: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#1c1b19",
  },
  buttonPressed: { opacity: 0.7 },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: "#faf9f6" },
});
