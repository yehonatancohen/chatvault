import { describe, expect, it } from "vitest";
import { catalogue, type StringKey } from "./strings";
import { translate, translatePlural } from "./translate";

/**
 * The catalogue's completeness is a compile-time guarantee — `he` is typed as
 * `Record<StringKey, string>` — so these tests are for what the type system cannot see.
 *
 * The parity test is the one that earns its place. A translator dropping `{count}` from a
 * Hebrew string produces a sentence that is grammatical, looks finished in review, and silently
 * prints "messages" with no number in front of it. Nothing else in the toolchain notices, and
 * on the Verify screen a missing count is a missing piece of evidence.
 */

const KEYS = Object.keys(catalogue.en) as StringKey[];

/**
 * Keys whose two languages are meant to read the same, so that "identical" can otherwise be
 * treated as "nobody translated this". Every entry needs a reason; the list should stay short.
 */
const IDENTICAL_BY_DESIGN = new Set<StringKey>([
  // A language is named in its own language, in both lists — that is the whole convention.
  "settings.language.he",
  "settings.language.en",
  // Placeholders and a separator, with no words in it to translate.
  "info.media.facts",
]);

function placeholdersIn(template: string): Set<string> {
  return new Set([...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!));
}

describe("catalogue parity", () => {
  it("has a Hebrew string for every English key", () => {
    const missing = KEYS.filter((key) => catalogue.he[key] === undefined);
    expect(missing).toEqual([]);
  });

  it("has no English key left untranslated by copy-paste", () => {
    const identical = KEYS.filter(
      (key) => !IDENTICAL_BY_DESIGN.has(key) && catalogue.he[key] === catalogue.en[key],
    );
    expect(identical).toEqual([]);
  });

  /**
   * Hebrew may *drop* a placeholder but never *invent* one.
   *
   * Dropping is legitimate and common in the `.one` forms: Hebrew carries the numeral in the
   * word — "קובץ אחד", not "1 קובץ" — so the singular has no `{count}` to fill. Inventing one is
   * always a bug, because nothing will ever supply it and `translate` leaves it on screen as
   * literal braces.
   */
  it("never introduces a placeholder the English string does not have", () => {
    const invented = KEYS.filter((key) => {
      const en = placeholdersIn(catalogue.en[key]);
      return [...placeholdersIn(catalogue.he[key])].some((name) => !en.has(name));
    });
    expect(invented).toEqual([]);
  });

  it("keeps every placeholder outside the singular plural forms", () => {
    // Anything that is not a `.one` string has no excuse to lose a parameter: a dropped
    // `{count}` there prints a sentence with the number missing, which on the Verify screen is
    // a missing piece of evidence rather than a typo.
    const dropped = KEYS.filter((key) => {
      if (key.endsWith(".one")) return false;
      const he = placeholdersIn(catalogue.he[key]);
      return [...placeholdersIn(catalogue.en[key])].some((name) => !he.has(name));
    });
    expect(dropped).toEqual([]);
  });

  it("pairs every plural stem in both languages", () => {
    const ones = KEYS.filter((key) => key.endsWith(".one"));
    const missingOther = ones.filter(
      (key) => !KEYS.includes(key.replace(/\.one$/, ".other") as StringKey),
    );
    expect(missingOther).toEqual([]);
  });
});

describe("translate", () => {
  it("returns the string for the language asked for", () => {
    expect(translate("en", "common.cancel")).toBe("Cancel");
    expect(translate("he", "common.cancel")).toBe("ביטול");
  });

  it("fills placeholders", () => {
    expect(translate("en", "common.showAll", { count: 12 })).toBe("Show all 12");
  });

  it("accepts numbers as well as strings", () => {
    expect(translate("en", "common.showAll", { count: 3 })).toContain("3");
  });

  it("leaves an unsupplied placeholder visible rather than printing undefined", () => {
    // A stray `{count}` on screen is a bug report. The word "undefined" mid-sentence reads to
    // the user as a broken archive.
    expect(translate("en", "common.showAll")).toBe("Show all {count}");
    expect(translate("en", "common.showAll", { other: 1 })).toBe("Show all {count}");
  });

  it("ignores parameters the template does not use", () => {
    expect(translate("en", "common.cancel", { count: 5 })).toBe("Cancel");
  });

  it("returns the key when there is no such string", () => {
    // Only reachable through a computed key, e.g. `import.stage.${stage}`.
    expect(translate("en", "no.such.key" as StringKey)).toBe("no.such.key");
  });
});

describe("translatePlural", () => {
  it("uses the singular at exactly one", () => {
    expect(translatePlural("en", "common.messages", 1)).toBe("1 message");
  });

  it("uses the plural at zero", () => {
    expect(translatePlural("en", "common.messages", 0)).toBe("0 messages");
  });

  it("uses the plural above one", () => {
    expect(translatePlural("en", "common.messages", 7)).toBe("7 messages");
  });

  it("interpolates count without the caller passing it", () => {
    expect(translatePlural("he", "common.files", 4)).toBe("4 קבצים");
  });

  it("takes Hebrew's singular from the word, not from a digit", () => {
    // Hebrew does not say "1 קובץ" — the numeral is carried by the word. The `.one` string
    // therefore has no placeholder at all, which the parity test above allows because `.one`
    // and `.other` are separate keys.
    expect(translatePlural("he", "common.files", 1)).toBe("קובץ אחד");
  });
});
