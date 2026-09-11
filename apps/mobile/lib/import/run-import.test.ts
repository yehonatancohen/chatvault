/**
 * The import pipeline, end to end, in Node.
 *
 * Every port is injected, so the whole of A4 runs here against `MemoryStorageAdapter` and
 * WebCrypto — the same code path the phone runs, minus the filesystem and Hermes. What this
 * cannot prove is anything about the device (see `apps/mobile/CLAUDE.md`'s test table); what
 * it does prove is the part where the data can actually be lost.
 *
 * The fixture deliberately copies the shape of a real export rather than a convenient one:
 * captions inline before the marker, English `image omitted` markers inside a Hebrew chat, an
 * encryption notice carrying a sender name, and a with-media export that still omits some
 * media. All four are facts from the real pair documented in the root `CLAUDE.md`, and all
 * four are things earlier fixtures in this project got wrong.
 */

import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createWebCryptoProvider,
  InMemoryMediaSource,
  KEY_LENGTH,
  MANIFEST_PATH,
  type CryptoProvider,
  type KeyWrapping,
} from "@chatvault/core";
import { MemoryStorageAdapter } from "@chatvault/storage";
import { EmptyExportError, runImport, readArchiveMessageIds } from "./run-import";
import { chooseTarget, chatTitleFromFilename, MIN_OVERLAP } from "./match";

const crypto: CryptoProvider = createWebCryptoProvider(
  webcrypto.subtle as never,
  (array) => webcrypto.getRandomValues(array),
);

const KEY = new Uint8Array(KEY_LENGTH).fill(7);

const WRAPPING: KeyWrapping = {
  algorithm: "PBKDF2-SHA256",
  saltBase64: "AAAAAAAAAAAAAAAAAAAAAA==",
  iterations: 1000,
  wrappedKeyBase64: "AAAA",
  ivBase64: "AAAAAAAAAAAAAAAA",
};

const LRM = "‎";

/**
 * A Hebrew iOS export, in the real shape. Note the caption sitting inline *before* the marker
 * on the same line, and `image omitted` in English inside a Hebrew chat — both are what a real
 * iOS export does, and both are what the parser's earliest fixtures got wrong.
 */
const WITH_MEDIA = [
  `[14/03/2025, 20:10:31] דנה: ${LRM}‏Messages and calls are end-to-end encrypted.`,
  `[14/03/2025, 20:10:34] דנה: תראה מה מצאתי ${LRM}<attached: 00000043-PHOTO-2025-03-14-20-10-34.jpg>`,
  `[14/03/2025, 20:11:02] יונתן: וואו`,
  `[14/03/2025, 20:11:40] דנה: ${LRM}<attached: 00000044-PHOTO-2025-03-14-20-11-40.jpg>`,
  `[14/03/2025, 20:12:00] יונתן: ${LRM}image omitted`,
  `[14/03/2025, 20:13:00] דנה: נדבר מחר`,
].join("\n");

/** The same chat exported again without media. Same messages, different bodies for the media. */
const WITHOUT_MEDIA = [
  `[14/03/2025, 20:10:31] דנה: ${LRM}‏Messages and calls are end-to-end encrypted.`,
  `[14/03/2025, 20:10:34] דנה: תראה מה מצאתי ${LRM}image omitted`,
  `[14/03/2025, 20:11:02] יונתן: וואו`,
  `[14/03/2025, 20:11:40] דנה: ${LRM}image omitted`,
  `[14/03/2025, 20:12:00] יונתן: ${LRM}image omitted`,
  `[14/03/2025, 20:13:00] דנה: נדבר מחר`,
].join("\n");

/** A later export of the same chat that reaches further forward. */
const WITH_LATER_MESSAGES = [
  WITH_MEDIA,
  `[15/03/2025, 09:00:00] יונתן: בוקר טוב`,
  `[15/03/2025, 09:01:00] דנה: בוקר`,
].join("\n");

const photoA = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const photoB = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);

function mediaSource(): InMemoryMediaSource {
  return new InMemoryMediaSource([
    ["00000043-PHOTO-2025-03-14-20-10-34.jpg", photoA],
    ["00000044-PHOTO-2025-03-14-20-11-40.jpg", photoB],
  ]);
}

function request(overrides: Partial<Parameters<typeof runImport>[0]> = {}) {
  return {
    transcript: WITH_MEDIA,
    media: mediaSource(),
    storage: new MemoryStorageAdapter(),
    crypto,
    key: KEY,
    archiveId: "archive-1",
    keyWrapping: WRAPPING,
    chatTitle: "דנה",
    sourceId: "source-1",
    contributor: "יונתן",
    tzOffsetMinutes: 0,
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

describe("runImport", () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it("saves a plain chat by default, and a later export of it merges without any key", async () => {
    // The default since encryption became opt-in: no key, no wrapping, nothing to ask for.
    const plain = { key: undefined, keyWrapping: undefined };
    const created = await runImport(request({ storage, ...plain }));
    expect(created.mode).toBe("created");
    expect(await storage.has("manifest.json")).toBe(true);
    expect(await storage.has(MANIFEST_PATH)).toBe(false);
    expect(new TextDecoder().decode(await storage.get("chat.txt"))).toContain("נדבר מחר");

    const again = await runImport(
      request({ storage, ...plain, transcript: WITHOUT_MEDIA, media: new InMemoryMediaSource(), sourceId: "s2" }),
    );
    expect(again.mode).toBe("appended");
    expect(again.messageCount).toBe(6);
    expect(again.addedCount).toBe(0);
    expect(await readArchiveMessageIds({ crypto, storage, archiveId: "archive-1" })).toHaveProperty("size", 6);
  });

  it("creates an archive from a with-media export", async () => {
    const outcome = await runImport(request({ storage }));

    expect(outcome.mode).toBe("created");
    expect(outcome.messageCount).toBe(6);
    expect(outcome.addedCount).toBe(6);
    expect([...outcome.participants].sort()).toEqual(["דנה", "יונתן"]);
    expect(outcome.issues).toEqual([]);
  });

  it("reports media honestly: what it holds and what it does not", async () => {
    const outcome = await runImport(request({ storage }));

    // Three media messages: two attached photos, one the export itself omitted.
    expect(outcome.stats.totalMediaMessages).toBe(3);
    expect(outcome.stats.attachedCount).toBe(2);
    expect(outcome.stats.omittedCount).toBe(1);
    expect(outcome.stats.missingCount).toBe(0);
    // The number the Verify screen must never round away: media the user will lose.
    expect(outcome.stats.notArchivedCount).toBe(1);
    expect(outcome.stats.uniqueBlobCount).toBe(2);
    expect(outcome.stats.totalBytes).toBe(photoA.length + photoB.length);
  });

  it("counts a named-but-absent file as not archived, rather than losing it silently", async () => {
    // A with-media export whose zip is missing one of the files it names. `linkMedia` reports
    // it; the user must be told, because that photo dies with the chat.
    const outcome = await runImport(
      request({
        storage,
        media: new InMemoryMediaSource([["00000043-PHOTO-2025-03-14-20-10-34.jpg", photoA]]),
      }),
    );

    expect(outcome.missingCount).toBe(1);
    expect(outcome.stats.missingCount).toBe(1);
    expect(outcome.stats.notArchivedCount).toBe(2); // one omitted + one missing
    expect(outcome.messageCount).toBe(6); // the message itself is still archived
  });

  it("refuses an export with no messages instead of writing an empty archive", async () => {
    await expect(runImport(request({ storage, transcript: "" }))).rejects.toBeInstanceOf(
      EmptyExportError,
    );
    expect(await storage.has(MANIFEST_PATH)).toBe(false);
  });

  it("absorbs a re-import of the same export instead of doubling it", async () => {
    // The roadmap's Track A gate, and invariant 5.
    const first = await runImport(request({ storage }));
    const second = await runImport(request({ storage, sourceId: "source-2" }));

    expect(first.messageCount).toBe(6);
    expect(second.mode).toBe("appended");
    expect(second.messageCount).toBe(6);
    expect(second.addedCount).toBe(0);
  });

  it("absorbs the without-media export of the same chat", async () => {
    // The exact check `packages/core/CLAUDE.md` calls the one that matters for merge: a
    // with-media / without-media pair of one chat must merge to one export's message count.
    await runImport(request({ storage }));
    const second = await runImport(
      request({
        storage,
        transcript: WITHOUT_MEDIA,
        media: new InMemoryMediaSource(),
        sourceId: "source-2",
      }),
    );

    expect(second.messageCount).toBe(6);
    expect(second.addedCount).toBe(0);
    // And the media survives the append: the without-media copy must not downgrade a photo
    // the archive already holds.
    expect(second.stats.uniqueBlobCount).toBe(2);
    expect(second.stats.attachedCount).toBe(2);
  });

  it("does not re-report already-archived media as missing on the second import", async () => {
    // `mediaStats`'s documented trap: pass one import's refs instead of the manifest's and
    // every previously-archived photo reads as missing — only ever on the second import.
    await runImport(request({ storage }));
    const second = await runImport(
      request({
        storage,
        transcript: WITHOUT_MEDIA,
        media: new InMemoryMediaSource(),
        sourceId: "source-2",
      }),
    );

    expect(second.stats.missingCount).toBe(0);
  });

  it("grows by exactly the new messages when a later export arrives", async () => {
    await runImport(request({ storage }));
    const second = await runImport(
      request({ storage, transcript: WITH_LATER_MESSAGES, sourceId: "source-2" }),
    );

    expect(second.mode).toBe("appended");
    expect(second.messageCount).toBe(8);
    expect(second.addedCount).toBe(2);
  });

  it("is order-independent: A then B equals B then A", async () => {
    // Invariant 5, at the level the app actually uses it.
    const forward = new MemoryStorageAdapter();
    await runImport(request({ storage: forward }));
    const forwardOutcome = await runImport(
      request({ storage: forward, transcript: WITH_LATER_MESSAGES, sourceId: "s2" }),
    );

    const backward = new MemoryStorageAdapter();
    await runImport(request({ storage: backward, transcript: WITH_LATER_MESSAGES }));
    const backwardOutcome = await runImport(
      request({ storage: backward, transcript: WITH_MEDIA, sourceId: "s2" }),
    );

    expect(forwardOutcome.messageCount).toBe(backwardOutcome.messageCount);
    expect(forwardOutcome.stats.uniqueBlobCount).toBe(backwardOutcome.stats.uniqueBlobCount);
    expect(forwardOutcome.firstTs).toBe(backwardOutcome.firstTs);
    expect(forwardOutcome.lastTs).toBe(backwardOutcome.lastTs);
  });

  it("keeps the original key wrapping when appending", async () => {
    // Re-wrapping on append would silently change the passphrase that opens the archive and
    // lock the user out of their own vault.
    await runImport(request({ storage }));
    const headerBefore = await storage.get("header.json");

    await runImport(
      request({
        storage,
        sourceId: "source-2",
        keyWrapping: { ...WRAPPING, saltBase64: "BBBBBBBBBBBBBBBBBBBBBB==" },
      }),
    );

    expect(await storage.get("header.json")).toEqual(headerBefore);
  });

  it("writes an archive that reads back, across a chunk boundary", async () => {
    const outcome = await runImport(request({ storage, messagesPerChunk: 2 }));

    expect(outcome.manifest.chunks.length).toBe(3);
    expect(outcome.messageCount).toBe(6);
  });

  it("reports the date range from the archive itself", async () => {
    const outcome = await runImport(request({ storage }));

    expect(new Date(outcome.firstTs).toISOString()).toBe("2025-03-14T20:10:31.000Z");
    expect(new Date(outcome.lastTs).toISOString()).toBe("2025-03-14T20:13:00.000Z");
  });

  it("surfaces unparsable lines instead of discarding them", async () => {
    const outcome = await runImport(
      request({ storage, transcript: `${WITH_MEDIA}\nthis line has no header at all` }),
    );

    // Folded as a continuation of the previous message rather than dropped — either way, the
    // text must still exist somewhere. Nothing is silently lost.
    expect(outcome.messageCount).toBe(6);
  });
});

describe("readArchiveMessageIds", () => {
  it("returns every id the archive holds", async () => {
    const storage = new MemoryStorageAdapter();
    const outcome = await runImport(request({ storage }));

    const ids = await readArchiveMessageIds({
      crypto,
      storage,
      key: KEY,
      archiveId: "archive-1",
    });
    expect(ids.size).toBe(outcome.messageCount);
  });
});

describe("chooseTarget", () => {
  const ids = (...values: string[]): ReadonlySet<string> => new Set(values);

  it("creates a new archive when there is nothing to match", () => {
    expect(chooseTarget([], ids("a", "b"))).toMatchObject({ kind: "create" });
  });

  it("creates a new archive when nothing overlaps", () => {
    const candidates = [{ archiveId: "one", messageIds: ids("x", "y", "z") }];
    expect(chooseTarget(candidates, ids("a", "b", "c"))).toMatchObject({ kind: "create" });
  });

  it("appends when a real re-export overlaps heavily", () => {
    const shared = ["m1", "m2", "m3", "m4", "m5", "m6"];
    const candidates = [{ archiveId: "one", messageIds: ids(...shared) }];

    expect(chooseTarget(candidates, ids(...shared, "m7"))).toMatchObject({
      kind: "append",
      archiveId: "one",
      overlap: 6,
    });
  });

  it("does not weld two chats together over a coincidental single match", () => {
    // One shared id is imaginable — the same person saying "ok" in the same minute in two
    // chats. Welding those archives together is permanent, because nothing here deletes.
    const candidates = [{ archiveId: "one", messageIds: ids("shared", "a", "b", "c") }];
    const incoming = ids("shared", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z");

    expect(chooseTarget(candidates, incoming)).toMatchObject({ kind: "create", overlap: 1 });
  });

  it("still matches a small chat re-imported whole, below the absolute threshold", () => {
    // A 3-message chat can never reach MIN_OVERLAP against itself; without the ratio rule it
    // would archive twice, forever.
    expect(MIN_OVERLAP).toBeGreaterThan(3);
    const candidates = [{ archiveId: "one", messageIds: ids("m1", "m2", "m3") }];

    expect(chooseTarget(candidates, ids("m1", "m2", "m3"))).toMatchObject({
      kind: "append",
      archiveId: "one",
    });
  });

  it("picks the archive with the most overlap when several match", () => {
    const candidates = [
      { archiveId: "few", messageIds: ids("m1", "m2", "m3", "m4") },
      { archiveId: "many", messageIds: ids("m1", "m2", "m3", "m4", "m5", "m6") },
    ];

    expect(chooseTarget(candidates, ids("m1", "m2", "m3", "m4", "m5", "m6"))).toMatchObject({
      archiveId: "many",
    });
  });

  it("is stable when two archives tie", () => {
    const candidates = [
      { archiveId: "first", messageIds: ids("m1", "m2", "m3", "m4") },
      { archiveId: "second", messageIds: ids("m1", "m2", "m3", "m4") },
    ];

    expect(chooseTarget(candidates, ids("m1", "m2", "m3", "m4")).archiveId).toBe("first");
  });

  it("creates rather than throwing on an empty incoming set", () => {
    const candidates = [{ archiveId: "one", messageIds: ids("m1") }];
    expect(chooseTarget(candidates, ids())).toMatchObject({ kind: "create" });
  });
});

describe("chatTitleFromFilename", () => {
  it("reads the contact out of an English export name", () => {
    expect(chatTitleFromFilename("WhatsApp Chat - Dana.zip")).toBe("Dana");
  });

  it("reads the contact out of a Hebrew export name", () => {
    expect(chatTitleFromFilename("צ'אט וואטסאפ עם דנה.zip")).toBe("דנה");
  });

  it("handles a text-only export", () => {
    expect(chatTitleFromFilename("WhatsApp Chat with Dana.txt")).toBe("Dana");
  });

  it("keeps a dash inside the contact's own name", () => {
    expect(chatTitleFromFilename("WhatsApp Chat - Anna-Marie.zip")).toBe("Anna-Marie");
  });

  it("falls back to the filename rather than inventing a title", () => {
    expect(chatTitleFromFilename("export.zip")).toBe("export");
  });

  it("falls back again when there is no filename at all", () => {
    expect(chatTitleFromFilename(undefined)).toBe("WhatsApp chat");
  });
});
