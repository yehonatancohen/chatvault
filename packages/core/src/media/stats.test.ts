import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWebCryptoProvider } from "../crypto/ports.js";
import type { MediaRef } from "../archive/format.js";
import type { ParsedMessage } from "../types.js";
import { linkMedia } from "./link.js";
import { InMemoryMediaSource } from "./source.js";
import { mediaStats } from "./stats.js";

const crypto = createWebCryptoProvider(webcrypto.subtle, (array) =>
  webcrypto.getRandomValues(array),
);

/** Distinct sizes throughout, so an off-by-one in the dedup arithmetic cannot hide. */
const blob = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);

let seq = 0;

function message(kind: ParsedMessage["kind"], filename?: string): ParsedMessage {
  const base = {
    id: `m${++seq}`,
    ts: 1_700_000_000_000,
    wallClock: "2025-03-14T20:10:34",
    sender: "Dana",
    body: "",
    kind,
  } as const;
  return filename === undefined ? base : { ...base, attachment: { filename } };
}

describe("mediaStats", () => {
  it("is all zeroes for an empty export", () => {
    expect(mediaStats([], [])).toEqual({
      totalMediaMessages: 0,
      attachedCount: 0,
      omittedCount: 0,
      missingCount: 0,
      notArchivedCount: 0,
      uniqueBlobCount: 0,
      totalBytes: 0,
      dedupSavedBytes: 0,
    });
  });

  it("counts attached and omitted separately and they sum to the total", async () => {
    // The shape of the real iOS pair: 21 media messages, 15 attached and 6 omitted, in an
    // export the user asked to include media in.
    const files: Record<string, Uint8Array> = {};
    const messages: ParsedMessage[] = [];
    for (let i = 0; i < 15; i++) {
      const filename = `0000000${i}-PHOTO.jpg`;
      files[filename] = blob(100 + i, i);
      messages.push(message("attachment", filename));
    }
    for (let i = 0; i < 6; i++) messages.push(message("omitted-media"));
    messages.push(message("text"), message("system"), message("deleted"));

    const { refs } = await linkMedia(messages, InMemoryMediaSource.from(files), crypto);
    const stats = mediaStats(refs, messages);

    expect(stats.attachedCount).toBe(15);
    expect(stats.omittedCount).toBe(6);
    expect(stats.totalMediaMessages).toBe(21);
    expect(stats.attachedCount + stats.omittedCount).toBe(stats.totalMediaMessages);
    expect(stats.missingCount).toBe(0);
    // The honest number: 6 photos vanish with the chat, even though the export "had media".
    expect(stats.notArchivedCount).toBe(6);
    // 100 + 101 + ... + 114
    expect(stats.totalBytes).toBe(1_605);
    expect(stats.dedupSavedBytes).toBe(0);
  });

  it("counts bytes over unique blobs and credits dedup with the duplicate names", () => {
    const refs: readonly MediaRef[] = [
      { sha256: "a".repeat(64), byteLength: 1_000, filenames: ["ios.jpg", "android.jpg"] },
      { sha256: "b".repeat(64), byteLength: 250, filenames: ["only.webp"] },
      {
        sha256: "c".repeat(64),
        byteLength: 7,
        filenames: ["one.mp4", "two.mp4", "three.mp4"],
      },
    ];
    const messages = [
      message("attachment", "ios.jpg"),
      message("attachment", "android.jpg"),
      message("attachment", "only.webp"),
      message("attachment", "one.mp4"),
      message("attachment", "two.mp4"),
      message("attachment", "three.mp4"),
    ];

    const stats = mediaStats(refs, messages);

    expect(stats.uniqueBlobCount).toBe(3);
    expect(stats.totalBytes).toBe(1_257);
    // Occurrences: 2*1000 + 1*250 + 3*7 = 2271, minus the 1257 actually stored.
    expect(stats.dedupSavedBytes).toBe(1_014);
    expect(stats.missingCount).toBe(0);
  });

  it("does not inflate dedup savings when two messages cite one filename", () => {
    const refs: readonly MediaRef[] = [
      { sha256: "a".repeat(64), byteLength: 500, filenames: ["once.jpg"] },
    ];
    const messages = [
      message("attachment", "once.jpg"),
      message("attachment", "once.jpg"),
      message("attachment", "once.jpg"),
    ];

    const stats = mediaStats(refs, messages);

    expect(stats.attachedCount).toBe(3);
    expect(stats.totalBytes).toBe(500);
    expect(stats.dedupSavedBytes).toBe(0);
  });

  it("counts an attachment with no matching ref as missing and not archived", async () => {
    const messages = [
      message("attachment", "here.jpg"),
      message("attachment", "gone.mp4"),
      message("omitted-media"),
    ];
    const source = InMemoryMediaSource.from({ "here.jpg": blob(64, 1) });

    const { refs, missing } = await linkMedia(messages, source, crypto);
    const stats = mediaStats(refs, messages);

    expect(missing).toHaveLength(1);
    expect(stats.attachedCount).toBe(2);
    expect(stats.missingCount).toBe(1);
    expect(stats.omittedCount).toBe(1);
    // One omitted plus one missing: two pieces of media the user loses on deletion.
    expect(stats.notArchivedCount).toBe(2);
    expect(stats.totalBytes).toBe(64);
  });

  it("treats an attachment message with no filename as missing", () => {
    const stats = mediaStats([], [message("attachment")]);

    expect(stats.attachedCount).toBe(1);
    expect(stats.missingCount).toBe(1);
    expect(stats.notArchivedCount).toBe(1);
  });

  it("ignores non-media messages entirely", () => {
    const stats = mediaStats([], [message("text"), message("system"), message("deleted")]);

    expect(stats.totalMediaMessages).toBe(0);
    expect(stats.notArchivedCount).toBe(0);
  });

  it("is byte-accurate end to end across two names for one blob", async () => {
    const photo = blob(4_096, 3);
    const video = blob(1_048_576, 9);
    const source = InMemoryMediaSource.from({
      "00000043-PHOTO-2025-03-14-20-10-34.jpg": photo,
      "IMG-20250314-WA0007.jpg": Uint8Array.from(photo),
      "00000056-VIDEO-2025-03-20-18-07-03.mp4": video,
    });
    const messages = [
      message("attachment", "00000043-PHOTO-2025-03-14-20-10-34.jpg"),
      message("attachment", "IMG-20250314-WA0007.jpg"),
      message("attachment", "00000056-VIDEO-2025-03-20-18-07-03.mp4"),
      message("omitted-media"),
    ];

    const { refs } = await linkMedia(messages, source, crypto);
    const stats = mediaStats(refs, messages);

    expect(stats.uniqueBlobCount).toBe(2);
    expect(stats.totalBytes).toBe(4_096 + 1_048_576);
    expect(stats.dedupSavedBytes).toBe(4_096);
    expect(stats.attachedCount).toBe(3);
    expect(stats.notArchivedCount).toBe(1);
  });
});
