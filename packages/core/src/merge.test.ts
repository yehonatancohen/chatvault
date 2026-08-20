import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { mergeBatches, mergeMerged, summarize, type MergedMessage } from "./merge.js";
import { parseExport } from "./parser/parse.js";
import { ANDROID_EN_24H, ANDROID_EN_24H_OTHER_MEMBER } from "./parser/fixtures.js";
import type { MessageKind, ParsedMessage } from "./types.js";

describe("mergeBatches — two members of the same group", () => {
  const mine = parseExport(ANDROID_EN_24H).messages;
  const theirs = parseExport(ANDROID_EN_24H_OTHER_MEMBER).messages;
  const merged = mergeBatches([
    { sourceId: "mine", messages: mine },
    { sourceId: "theirs", messages: theirs },
  ]);

  it("produces the union, not the concatenation", () => {
    expect(mine).toHaveLength(6);
    expect(theirs).toHaveLength(5);
    // Four messages overlap; their export adds one message mine never had.
    expect(merged).toHaveLength(7);
  });

  it("matches the same photo across a with-media and a without-media export", () => {
    const media = merged.filter(
      (m) => m.kind === "attachment" || m.kind === "omitted-media",
    );
    expect(media).toHaveLength(1);
    // The real attachment must win over the other member's `<Media omitted>` placeholder.
    expect(media[0]?.kind).toBe("attachment");
    expect(media[0]?.attachment?.filename).toBe("IMG-20240315-WA0001.jpg");
    expect(media[0]?.sourceIds).toEqual(["mine", "theirs"]);
  });

  it("attributes which import each message came from", () => {
    const stats = summarize(merged);
    expect(stats.total).toBe(7);
    // Their unique contribution plus the two messages only my export had.
    expect(stats.uniqueToMerge).toBe(3);
    expect(stats.contributedBy).toEqual({ mine: 6, theirs: 5 });
  });

  it("orders the result chronologically", () => {
    const timestamps = merged.map((m) => m.ts);
    expect([...timestamps].sort((a, b) => a - b)).toEqual(timestamps);
  });
});

describe("mergeBatches — idempotency", () => {
  const messages = parseExport(ANDROID_EN_24H).messages;

  it("importing the same export twice changes nothing", () => {
    const once = mergeBatches([{ sourceId: "a", messages }]);
    const twice = mergeBatches([
      { sourceId: "a", messages },
      { sourceId: "a", messages },
    ]);
    expect(twice).toEqual(once);
  });

  it("re-merging an already-merged archive is a no-op", () => {
    const once = mergeBatches([{ sourceId: "a", messages }]);
    expect(mergeMerged(once, once)).toEqual(once);
  });
});

/**
 * Property tests. These are the actual guarantee behind the group-append feature: members
 * contribute in any order, repeatedly, with no coordination. Examples can only show the
 * cases we thought of; these check the law itself.
 */

const KINDS: readonly MessageKind[] = [
  "text",
  "attachment",
  "omitted-media",
  "deleted",
  "system",
];

/**
 * Messages drawn from a deliberately small id pool, so collisions — the interesting case —
 * happen constantly. Colliding messages get independently random content, which is exactly
 * the situation two real members' exports create.
 */
const arbMessage: fc.Arbitrary<ParsedMessage> = fc
  .record({
    id: fc.constantFrom("id-1", "id-2", "id-3", "id-4"),
    ts: fc.integer({ min: 1_700_000_000_000, max: 1_700_000_900_000 }),
    wallClock: fc.constant("2024-03-15T09:05:00"),
    sender: fc.option(fc.constantFrom("Dana", "Ravid"), { nil: null }),
    body: fc.string({ maxLength: 12 }),
    kind: fc.constantFrom(...KINDS),
    filename: fc.option(fc.constantFrom("a.jpg", "b.jpg"), { nil: undefined }),
  })
  .map(({ filename, ...rest }) =>
    filename === undefined ? rest : { ...rest, attachment: { filename } },
  );

const arbBatch = (sourceId: string) =>
  fc.array(arbMessage, { maxLength: 8 }).map((messages) => ({ sourceId, messages }));

/** Compare ignoring source attribution, which legitimately grows as sources are added. */
const withoutSources = (messages: readonly MergedMessage[]): ParsedMessage[] =>
  messages.map(({ sourceIds: _sourceIds, ...rest }) => rest);

describe("mergeBatches — algebraic properties", () => {
  it("is commutative: contribution order never changes the result", () => {
    fc.assert(
      fc.property(arbBatch("a"), arbBatch("b"), (a, b) => {
        expect(mergeBatches([a, b])).toEqual(mergeBatches([b, a]));
      }),
      { numRuns: 500 },
    );
  });

  it("is idempotent: re-importing a batch adds nothing", () => {
    fc.assert(
      fc.property(arbBatch("a"), arbBatch("b"), (a, b) => {
        expect(mergeBatches([a, b, a])).toEqual(mergeBatches([a, b]));
      }),
      { numRuns: 500 },
    );
  });

  it("is associative: incremental merging equals merging all at once", () => {
    fc.assert(
      fc.property(arbBatch("a"), arbBatch("b"), arbBatch("c"), (a, b, c) => {
        const leftward = mergeMerged(mergeBatches([a, b]), mergeBatches([c]));
        const rightward = mergeMerged(mergeBatches([a]), mergeBatches([b, c]));
        expect(withoutSources(leftward)).toEqual(withoutSources(rightward));
      }),
      { numRuns: 500 },
    );
  });

  it("never loses a message: every input id survives", () => {
    fc.assert(
      fc.property(arbBatch("a"), arbBatch("b"), (a, b) => {
        const expected = new Set([...a.messages, ...b.messages].map((m) => m.id));
        const actual = new Set(mergeBatches([a, b]).map((m) => m.id));
        expect(actual).toEqual(expected);
      }),
      { numRuns: 500 },
    );
  });
});
