import { computeMessageId } from "../identity.js";
import type { MessageBatch } from "../merge.js";
import type { ImportSource, ParsedMessage } from "../types.js";
import type { ArchiveContent } from "./writer.js";
import type { KeyWrapping } from "./format.js";

/**
 * Shared fixtures for the archive suite, in the shape of `parser/fixtures.ts`: isomorphic, no
 * `node:*`, so the file obeys the same rule as everything else in this package. The tests
 * supply the Node-only parts (a real WebCrypto) themselves.
 */

export const testKey = (seed = 7): Uint8Array =>
  Uint8Array.from({ length: 32 }, (_, i) => (i * 31 + seed) % 251);

/**
 * A stand-in for whatever the passphrase layer produces. The writer copies this verbatim and
 * never interprets it, which is precisely why a literal is an honest fixture here.
 */
export const testKeyWrapping: KeyWrapping = {
  algorithm: "PBKDF2-SHA256",
  saltBase64: "c2FsdHktc2FsdA==",
  iterations: 210_000,
  wrappedKeyBase64: "d3JhcHBlZC1rZXktYnl0ZXM=",
  ivBase64: "aXYtdHdlbHZlLQ==",
};

export const testSource = (id: string): ImportSource => ({
  id,
  contributor: id,
  tzOffsetMinutes: 0,
  importedAt: 1_700_000_000_000,
  dialect: { dateOrder: "DMY", platform: "android", hasSeconds: false, clock: "24h" },
});

/** A text message at a given minute; identity is computed the same way the parser computes it. */
export function message(minuteOffset: number, sender: string, body: string): ParsedMessage {
  const base = Date.UTC(2024, 2, 15, 9, 0, 0);
  const ts = base + minuteOffset * 60_000;
  const wallClock = new Date(ts).toISOString().slice(0, 19);
  return {
    id: computeMessageId({ wallClock, sender, body, kind: "text" }),
    ts,
    wallClock,
    sender,
    body,
    kind: "text",
  };
}

export const batch = (sourceId: string, messages: readonly ParsedMessage[]): MessageBatch => ({
  sourceId,
  messages,
});

export function content(overrides: Partial<ArchiveContent> = {}): ArchiveContent {
  return {
    chatTitle: "Trip planning",
    participants: [{ id: "p1", displayName: "Dana", aliases: ["+972 50-123-4567"] }],
    sources: [testSource("s1")],
    batches: [batch("s1", [message(0, "Dana", "first"), message(1, "Ravid", "second")])],
    ...overrides,
  };
}
