/**
 * Turning a key into a string. Pure, and therefore tested (`translate.test.ts`).
 *
 * The interesting decisions are both about failing safely, because this runs on every label in
 * the app and a translation bug must never be able to blank a screen:
 *
 * - **A missing placeholder is left as `{name}` rather than printed as `undefined`.** A visible
 *   `{count}` in the UI is an obvious bug report; the word "undefined" in the middle of a
 *   sentence looks like a broken archive to the person reading it.
 * - **An unknown key returns the key.** It cannot happen through the typed API — `StringKey` is
 *   derived from the English catalogue — but `t` is also reachable with a computed key
 *   (`import.stage.${stage}`), and a key on screen is debuggable where a crash is not.
 */

import { catalogue, type StringKey } from "./strings";
import type { Language } from "../settings/settings";

export type TranslationParams = Readonly<Record<string, string | number>>;

export function translate(
  language: Language,
  key: StringKey,
  params?: TranslationParams,
): string {
  const template = catalogue[language][key] ?? catalogue.en[key];
  if (template === undefined) return key;
  if (params === undefined) return template;

  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * The plural pair: `key` is a stem, and `.one` / `.other` are appended.
 *
 * `count` is passed through as a parameter as well, so `"{count} messages"` works without the
 * caller interpolating it a second time. Hebrew's dual form is deliberately not modelled —
 * modern usage takes the plural from two upward, which is exactly what `.other` gives.
 */
export function translatePlural(
  language: Language,
  stem: string,
  count: number,
  params?: TranslationParams,
): string {
  const key = `${stem}.${count === 1 ? "one" : "other"}` as StringKey;
  return translate(language, key, { count, ...params });
}
