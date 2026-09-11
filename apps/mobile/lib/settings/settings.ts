/**
 * App-wide settings: language and appearance.
 *
 * **Read synchronously at module load, on purpose.** Language decides layout direction, and
 * `I18nManager.forceRTL` has to be called before React renders anything — a direction applied
 * one frame late lays the whole app out backwards and then flips it, which looks broken. So
 * this uses `File.textSync()` rather than the async `text()` the rest of the app uses, and does
 * it once at import time (`lib/i18n/bootstrap.ts` is what imports it first).
 *
 * A missing, unreadable or nonsense file yields the defaults rather than throwing. Settings are
 * a convenience: no archive content depends on them, and a corrupt preferences file must never
 * be able to stop the app from starting.
 *
 * **Deliberately not in `expo-secure-store` and not inside any archive directory.** There is
 * nothing secret here, and `ArchiveStoragePort` holds sealed archive objects and nothing else —
 * the same rule `lib/archive/preferences.ts` follows for the same reason.
 */

import { Directory, File, Paths } from "expo-file-system";

export type Language = "he" | "en";

/** `system` follows the phone; the other two override it. */
export type Appearance = "system" | "light" | "dark";

export interface Settings {
  readonly language: Language;
  readonly appearance: Appearance;
  /** Whether the import screen's "Protect with a passphrase" switch starts on. Off: opt-in. */
  readonly protectNewChats: boolean;
  /**
   * The user tapped "Don't remind me" on the unsaved-media note. Media WhatsApp didn't include
   * is normal — the note is a one-line heads-up, and someone who has read it once may hide it.
   */
  readonly hideMediaNote: boolean;
}

/**
 * Hebrew, not the device language.
 *
 * This is a product decision rather than an oversight: the app is built for Hebrew WhatsApp
 * exports first, and the parser's hardest case — bidi marks, RTL senders — is the one these
 * users have. Anyone who wants English finds it in Settings, which is a smaller cost than a
 * Hebrew speaker landing in English.
 */
export const DEFAULT_SETTINGS: Settings = {
  language: "he",
  appearance: "system",
  protectNewChats: false,
  hideMediaNote: false,
};

const DIRECTORY = "settings";
const FILE_NAME = "app.json";

function settingsFile(): File {
  return new File(new Directory(Paths.document, DIRECTORY), FILE_NAME);
}

function coerce(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;
  const { language, appearance, protectNewChats, hideMediaNote } = raw as Record<string, unknown>;
  return {
    protectNewChats: protectNewChats === true,
    hideMediaNote: hideMediaNote === true,
    language: language === "en" || language === "he" ? language : DEFAULT_SETTINGS.language,
    appearance:
      appearance === "light" || appearance === "dark" || appearance === "system"
        ? appearance
        : DEFAULT_SETTINGS.appearance,
  };
}

let cached: Settings | undefined;

/** The current settings. Cheap after the first call — the file is read once per process. */
export function readSettingsSync(): Settings {
  if (cached !== undefined) return cached;
  try {
    const file = settingsFile();
    cached = file.exists ? coerce(JSON.parse(file.textSync())) : DEFAULT_SETTINGS;
  } catch {
    cached = DEFAULT_SETTINGS;
  }
  return cached;
}

type Listener = (settings: Settings) => void;
const listeners = new Set<Listener>();

export function subscribeToSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Persist a change and tell everyone listening.
 *
 * Writing is synchronous (`File.write`), which is fine for a file this size and means the
 * setting is on disk before the UI reflects it — so a crash immediately after a change cannot
 * leave the app showing one thing and remembering another.
 */
export function updateSettings(patch: Partial<Settings>): Settings {
  const next = coerce({ ...readSettingsSync(), ...patch });
  cached = next;
  try {
    const file = settingsFile();
    file.parentDirectory.create({ intermediates: true, idempotent: true });
    file.write(JSON.stringify(next));
  } catch {
    // An unwritable settings file costs the user their choice on next launch and nothing else.
    // Failing the interaction over it would be worse than forgetting it.
  }
  for (const listener of listeners) listener(next);
  return next;
}
