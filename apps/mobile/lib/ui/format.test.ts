import { describe, expect, it } from "vitest";
import { formatBytes, formatCount, formatDate, formatRange, plural } from "./format";

describe("formatBytes", () => {
  it("keeps small files visible instead of rounding them to zero", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("scales to the sizes a with-media export actually reaches", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.50 GB");
  });

  it("does not print nonsense for nonsense", () => {
    expect(formatBytes(-1)).toBe("-");
    expect(formatBytes(Number.NaN)).toBe("-");
  });
});

describe("formatCount", () => {
  it("separates thousands", () => {
    expect(formatCount(40000)).toBe("40,000");
    expect(formatCount(7)).toBe("7");
  });
});

describe("formatDate / formatRange", () => {
  const march14 = new Date(2025, 2, 14, 20, 10).getTime();
  const march15 = new Date(2025, 2, 15, 9, 0).getTime();

  it("formats a date the way a person reads one", () => {
    expect(formatDate(march14)).toBe("14 Mar 2025");
  });

  it("collapses a single-day range", () => {
    expect(formatRange(march14, march14 + 60_000)).toBe("14 Mar 2025");
  });

  it("shows both ends of a real range", () => {
    expect(formatRange(march14, march15)).toBe("14 Mar 2025 — 15 Mar 2025");
  });

  it("reports an empty archive's range as absent, not as 1970", () => {
    // `ArchiveWriter` writes zeroes for an empty range rather than a sentinel.
    expect(formatRange(0, 0)).toBe("-");
    expect(formatDate(0)).toBe("-");
  });
});

describe("Hebrew dates", () => {
  it("uses transliterated Gregorian months, not the Hebrew calendar", () => {
    // These timestamps come from WhatsApp and are Gregorian. Rendering them as Hebrew-calendar
    // dates would be a different date, not a translation of the same one.
    expect(formatDate(Date.UTC(2025, 2, 14, 12), "he")).toContain("מרץ");
    expect(formatDate(Date.UTC(2025, 2, 14, 12), "he")).toContain("2025");
  });

  it("keeps the same digits and shape as English, so a number survives a language change", () => {
    const en = formatDate(Date.UTC(2025, 2, 14, 12), "en");
    const he = formatDate(Date.UTC(2025, 2, 14, 12), "he");
    expect(he.split(" ")[0]).toBe(en.split(" ")[0]);
    expect(he.split(" ")[2]).toBe(en.split(" ")[2]);
  });

  it("still reports an absent range as absent", () => {
    expect(formatRange(0, 0, "he")).toBe("-");
    expect(formatDate(0, "he")).toBe("-");
  });
});

describe("plural", () => {
  it("agrees with the number in front of it", () => {
    expect(plural(1, "photo")).toBe("1 photo");
    expect(plural(3, "photo")).toBe("3 photos");
    expect(plural(0, "photo")).toBe("0 photos");
  });

  it("takes an irregular plural", () => {
    expect(plural(2, "person", "people")).toBe("2 people");
  });
});
