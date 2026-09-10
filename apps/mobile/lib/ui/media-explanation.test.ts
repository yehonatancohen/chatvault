import { describe, expect, it } from "vitest";
import type { MediaStats } from "@chatvault/core";
import { explainMedia } from "./media-explanation";
import { colorForParticipant, summarizeParticipants } from "./participants";

function stats(overrides: Partial<MediaStats>): MediaStats {
  return {
    totalMediaMessages: 0,
    attachedCount: 0,
    omittedCount: 0,
    missingCount: 0,
    notArchivedCount: 0,
    uniqueBlobCount: 0,
    totalBytes: 0,
    dedupSavedBytes: 0,
    ...overrides,
  };
}

describe("explainMedia", () => {
  it("says so plainly when everything was saved", () => {
    const result = explainMedia(
      stats({ totalMediaMessages: 4, attachedCount: 4, uniqueBlobCount: 4 }),
      true,
    );

    expect(result.severity).toBe("none");
    expect(result.headline).toMatch(/Every photo and file/);
    expect(result.causes).toEqual([]);
    expect(result.nextSteps).toEqual([]);
  });

  it("does not claim media was saved in a chat that never had any", () => {
    const result = explainMedia(stats({}), false);
    expect(result.severity).toBe("none");
    expect(result.headline).toMatch(/no photos or files/);
  });

  it("separates what WhatsApp had already lost from what the export truncated", () => {
    const result = explainMedia(
      stats({
        totalMediaMessages: 10,
        attachedCount: 7,
        omittedCount: 3,
        missingCount: 2,
        notArchivedCount: 5,
        uniqueBlobCount: 5,
      }),
      true,
    );

    expect(result.severity).toBe("some");
    expect(result.causes).toHaveLength(2);
    expect(result.causes[0]?.count).toBe(3);
    expect(result.causes[0]?.why).toMatch(/no longer on this phone/);
    expect(result.causes[1]?.count).toBe(2);
    expect(result.causes[1]?.why).toMatch(/not inside the file you shared/);
  });

  it("always says the messages themselves survive", () => {
    // The fear the headline creates, answered in the same box: a missing file is not a
    // missing message.
    const result = explainMedia(
      stats({ totalMediaMessages: 3, attachedCount: 2, omittedCount: 1, notArchivedCount: 1 }),
      true,
    );
    expect(result.stillSaved).toMatch(/messages themselves are safe/);
  });

  it("recognises a text-only export instead of blaming WhatsApp for losing files", () => {
    // Every media message omitted, from a .txt share: the files are not gone at all, they were
    // never asked for. Telling this user their media "was already lost" would be false and
    // would send them looking for a problem that does not exist.
    const result = explainMedia(
      stats({ totalMediaMessages: 6, omittedCount: 6, notArchivedCount: 6 }),
      false,
    );

    expect(result.severity).toBe("all");
    expect(result.headline).toMatch(/did not include the media/);
    expect(result.causes[0]?.why).toMatch(/still in WhatsApp/);
    expect(result.nextSteps[0]).toMatch(/Attach Media/);
  });

  it("does not offer the text-only explanation when the export did carry media", () => {
    const result = explainMedia(
      stats({ totalMediaMessages: 6, omittedCount: 6, notArchivedCount: 6 }),
      true,
    );
    expect(result.causes[0]?.why).toMatch(/no longer on this phone/);
    expect(result.nextSteps.join(" ")).not.toMatch(/Attach Media/);
  });

  it("always ends with the one fix that works when nothing else does", () => {
    // Another member's export is the only route to media this phone genuinely no longer has,
    // and it is the whole reason the archive is a union rather than a copy.
    for (const hadMedia of [true, false]) {
      const result = explainMedia(
        stats({ totalMediaMessages: 3, omittedCount: 3, notArchivedCount: 3 }),
        hadMedia,
      );
      expect(result.nextSteps[result.nextSteps.length - 1]).toMatch(/someone else in this chat/);
    }
  });

  it("reports what is saved even while reporting a loss", () => {
    const result = explainMedia(
      stats({ totalMediaMessages: 5, attachedCount: 4, omittedCount: 1, notArchivedCount: 1, uniqueBlobCount: 4 }),
      true,
    );
    expect(result.saved).toBe("4 files saved and encrypted.");
  });

  it("uses singular forms for one of anything", () => {
    const result = explainMedia(
      stats({ totalMediaMessages: 2, attachedCount: 1, omittedCount: 1, notArchivedCount: 1, uniqueBlobCount: 1 }),
      true,
    );
    expect(result.headline).toBe("1 file could not be saved");
    expect(result.saved).toBe("1 file saved and encrypted.");
  });
});

describe("summarizeParticipants", () => {
  it("names both people in a 1:1 chat", () => {
    expect(summarizeParticipants(["Dana", "Yonatan"]).label).toBe("Dana and Yonatan");
    expect(summarizeParticipants(["Dana", "Yonatan"]).collapsible).toBe(false);
  });

  it("names one", () => {
    expect(summarizeParticipants(["Dana"]).label).toBe("Dana");
  });

  it("collapses a large group", () => {
    const names = Array.from({ length: 40 }, (_, i) => `Person ${i + 1}`);
    const summary = summarizeParticipants(names);

    expect(summary.shown).toHaveLength(3);
    expect(summary.hiddenCount).toBe(37);
    expect(summary.label).toBe("Person 1, Person 2, Person 3 and 37 others");
    expect(summary.collapsible).toBe(true);
  });

  it("shows the last name rather than hiding exactly one", () => {
    // "and 1 others" is both ungrammatical and pointless — the name is shorter than the excuse.
    const summary = summarizeParticipants(["A", "B", "C", "D"]);
    expect(summary.hiddenCount).toBe(0);
    expect(summary.label).toBe("A, B, C and D");
  });

  it("survives an empty participant list", () => {
    expect(summarizeParticipants([]).label).toBe("No one");
  });
});

describe("colorForParticipant", () => {
  it("is stable for a name", () => {
    expect(colorForParticipant("דנה")).toBe(colorForParticipant("דנה"));
  });

  it("differs between names", () => {
    expect(colorForParticipant("Dana")).not.toBe(colorForParticipant("Yonatan"));
  });

  it("stays within one saturation and lightness, so no one is louder", () => {
    expect(colorForParticipant("anybody")).toMatch(/^hsl\(\d{1,3}, 45%, 38%\)$/);
  });
});
