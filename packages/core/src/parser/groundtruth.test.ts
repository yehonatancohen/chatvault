import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parseExport } from "./parse.js";
import { mergeBatches } from "../merge.js";
import type { ParseResult } from "../types.js";

/**
 * Ground-truth check against a REAL WhatsApp export on your machine.
 *
 * Opt-in: skipped unless `CVAULT_EXPORT_A` points at an unzipped export directory. Set
 * `CVAULT_EXPORT_B` as well — ideally the same chat exported a second time, once with media
 * and once without — to additionally prove the two merge into one archive rather than two.
 *
 *   CVAULT_EXPORT_A=/tmp/with-media CVAULT_EXPORT_B=/tmp/without-media pnpm vitest run groundtruth
 *
 * Why this exists: fixtures can only confirm what we already believe. Every parser bug found
 * in this project so far was a case where the code and its tests shared the same wrong
 * assumption, and each was caught by comparing against a real file instead. This check derives
 * its expectations from the export itself — line counts, and the media files actually sitting
 * in the folder — so it cannot inherit the parser's assumptions.
 *
 * The exports themselves must live OUTSIDE the repo. Real chats contain other people's
 * personal data (root CLAUDE.md, invariant 6); this test reads them, never copies them.
 */

interface LoadedExport {
  readonly dir: string;
  readonly raw: string;
  readonly mediaOnDisk: ReadonlySet<string>;
  readonly parsed: ParseResult;
}

function loadExport(dir: string): LoadedExport {
  const chatPath = join(dir, "_chat.txt");
  if (!existsSync(chatPath)) {
    throw new Error(`No _chat.txt in ${dir} — unzip the export first.`);
  }
  const raw = readFileSync(chatPath, "utf8");
  return {
    dir,
    raw,
    mediaOnDisk: new Set(readdirSync(dir).filter((f) => f !== "_chat.txt")),
    parsed: parseExport(raw),
  };
}

const dirA = process.env["CVAULT_EXPORT_A"];
const dirB = process.env["CVAULT_EXPORT_B"];

describe.skipIf(!dirA)("ground truth: a real export", () => {
  const loaded = [dirA, dirB].filter((d): d is string => Boolean(d)).map(loadExport);

  for (const { dir, raw, mediaOnDisk, parsed } of loaded) {
    describe(basename(dir), () => {
      const { messages, issues, dialect, participants } = parsed;
      const media = messages.filter(
        (m) => m.kind === "attachment" || m.kind === "omitted-media",
      );
      const attachments = messages.filter((m) => m.kind === "attachment");

      it("reports what it found", () => {
        console.log(
          `  ${dialect.platform} ${dialect.dateOrder} ${dialect.clock}` +
            `${dialect.hasSeconds ? " +seconds" : ""} | ` +
            `${messages.length} messages, ${participants.length} participants, ` +
            `${media.length} media (${attachments.length} attached, ` +
            `${media.length - attachments.length} omitted), ` +
            `${mediaOnDisk.size} files on disk`,
        );
        expect(messages.length).toBeGreaterThan(0);
      });

      it("parses without issues", () => {
        for (const issue of issues.slice(0, 5)) {
          console.log(`    line ${issue.line}: ${issue.reason}: ${issue.raw.slice(0, 60)}`);
        }
        expect(issues).toEqual([]);
      });

      it("accounts for every line of the source file", () => {
        const sourceLines = raw
          .replace(/\r\n?/g, "\n")
          .replace(/\n$/, "")
          .split("\n").length;

        const accounted = messages.reduce((total, m) => {
          const isMedia = m.kind === "attachment" || m.kind === "omitted-media";
          const bodyLines = m.body === "" ? 0 : m.body.split("\n").length;
          // A captioned media message shares its first line with the marker, so the marker
          // adds a line only when there is no caption to occupy it.
          return total + (isMedia && bodyLines > 0 ? bodyLines : (isMedia ? 1 : 0) + bodyLines);
        }, 0);

        expect(accounted + issues.length).toBe(sourceLines);
      });

      it("resolves every attachment to a file present in the export", () => {
        const missing = attachments
          .map((m) => m.attachment?.filename)
          .filter((f): f is string => f !== undefined && !mediaOnDisk.has(f));
        expect(missing).toEqual([]);
      });

      it("references every media file that is present", () => {
        const referenced = new Set(attachments.map((m) => m.attachment?.filename));
        expect([...mediaOnDisk].filter((f) => !referenced.has(f))).toEqual([]);
      });

      it("leaves no raw marker text inside a message body", () => {
        const leaked = messages.filter((m) => /<attached:|\bomitted$/i.test(m.body));
        expect(leaked.map((m) => m.body.slice(0, 50))).toEqual([]);
      });

      it("identifies participants", () => {
        expect(participants.length).toBeGreaterThan(0);
      });
    });
  }

  describe.skipIf(loaded.length < 2)("merging both exports", () => {
    it("deduplicates into one archive rather than concatenating", () => {
      const [first, second] = loaded;
      if (!first || !second) return;

      const merged = mergeBatches([
        { sourceId: "a", messages: first.parsed.messages },
        { sourceId: "b", messages: second.parsed.messages },
      ]);
      const concatenated =
        first.parsed.messages.length + second.parsed.messages.length;
      const unmatched = merged.filter((m) => m.sourceIds.length === 1);

      console.log(
        `  merged ${merged.length} (concatenation would be ${concatenated}), ` +
          `${unmatched.length} seen in only one export, ` +
          `${merged.filter((m) => m.kind === "attachment").length} attachments survived`,
      );
      for (const m of unmatched.slice(0, 5)) {
        console.log(`    UNMATCHED ${m.wallClock} ${m.kind} ${JSON.stringify(m.body.slice(0, 40))}`);
      }

      expect(merged.length).toBeLessThan(concatenated);

      // Two exports of the same chat taken minutes apart should match completely. If they
      // cover different time ranges, expect edge messages here and read this as a report
      // rather than a failure.
      expect(unmatched.length).toBe(0);
    });

    it("agrees on the media count across a with-media and without-media pair", () => {
      const [first, second] = loaded;
      if (!first || !second) return;
      const count = (e: LoadedExport) =>
        e.parsed.messages.filter(
          (m) => m.kind === "attachment" || m.kind === "omitted-media",
        ).length;
      expect(count(first)).toBe(count(second));
    });
  });
});
