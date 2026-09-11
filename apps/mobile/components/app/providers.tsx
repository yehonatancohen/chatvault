/**
 * The one context the whole app reads: language, appearance, and the palette they resolve to.
 *
 * It is a single context rather than three because the three always change together and every
 * consumer wants at least two of them — a screen that re-themes without re-translating is not a
 * state worth being able to represent.
 *
 * **`createStyles` is the important export here.** Every screen used to hold a module-scope
 * `StyleSheet.create` closing over a single frozen palette, which is exactly why dark mode was
 * not possible without touching every file. `createStyles` keeps the same authoring shape —
 * one style object per screen, written once — but defers it until a theme exists and caches the
 * result per theme, so switching appearance costs one `StyleSheet.create` per screen the first
 * time and nothing on every switch after that.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, useColorScheme } from "react-native";
import {
  DEFAULT_SETTINGS,
  readSettingsSync,
  subscribeToSettings,
  updateSettings,
  type Appearance,
  type Language,
  type Settings,
} from "../../lib/settings/settings";
import { isRTLLanguage } from "../../lib/i18n/bootstrap";
import { setFormatLanguage } from "../../lib/ui/format";
import { APP_NAME, type StringKey } from "../../lib/i18n/strings";
import { translate, translatePlural, type TranslationParams } from "../../lib/i18n/translate";
import { darkTheme, lightTheme, type Theme } from "../../lib/ui/theme";

export interface AppContextValue {
  readonly settings: Settings;
  readonly theme: Theme;
  readonly language: Language;
  /** Whether the *chosen language* is right-to-left. Not the same as `I18nManager.isRTL`. */
  readonly isRTL: boolean;
  /** The app's own name, in the current language. */
  readonly appName: string;
  readonly t: (key: StringKey, params?: TranslationParams) => string;
  readonly tp: (stem: string, count: number, params?: TranslationParams) => string;
  readonly setLanguage: (language: Language) => void;
  readonly setAppearance: (appearance: Appearance) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => readSettingsSync());
  const systemScheme = useColorScheme();

  useEffect(() => subscribeToSettings(setSettings), []);

  // Dates and numbers are formatted by plain functions called from everywhere, including
  // non-React code; rather than thread a language through every call site, the formatter keeps
  // a module-level current language that this keeps in step. See `lib/ui/format.ts`.
  useEffect(() => {
    setFormatLanguage(settings.language);
  }, [settings.language]);

  const theme = useMemo(() => {
    const wantsDark =
      settings.appearance === "dark" ||
      (settings.appearance === "system" && systemScheme === "dark");
    return wantsDark ? darkTheme : lightTheme;
  }, [settings.appearance, systemScheme]);

  const { language } = settings;

  const t = useCallback(
    (key: StringKey, params?: TranslationParams) =>
      translate(language, key, { app: APP_NAME[language], ...params }),
    [language],
  );

  const tp = useCallback(
    (stem: string, count: number, params?: TranslationParams) =>
      translatePlural(language, stem, count, { app: APP_NAME[language], ...params }),
    [language],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      theme,
      language,
      isRTL: isRTLLanguage(language),
      appName: APP_NAME[language],
      t,
      tp,
      setLanguage: (next) => updateSettings({ language: next }),
      setAppearance: (next) => updateSettings({ appearance: next }),
    }),
    [settings, theme, language, t, tp],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (value === undefined) {
    // Reaching here means a screen rendered outside `app/_layout.tsx`, which under expo-router
    // means a route file in the wrong place. Failing loudly beats silently falling back to
    // English on one screen.
    throw new Error("useApp must be used inside <AppProvider>");
  }
  return value;
}

/** The palette. The most-used half of `useApp`, so it gets its own name. */
export function useTheme(): Theme {
  return useApp().theme;
}

/** The translator, for a component that needs strings but not colours. */
export function useT(): AppContextValue["t"] {
  return useApp().t;
}

type NamedStyles<T> = StyleSheet.NamedStyles<T>;

/**
 * A screen's stylesheet, built from whichever theme is active.
 *
 * Usage mirrors what it replaces:
 *
 * ```ts
 * const useStyles = createStyles((t) => ({ card: { backgroundColor: t.panel } }));
 * // inside the component (and inside any sub-component that needs styles):
 * const styles = useStyles();
 * ```
 *
 * The cache is keyed on the theme object, and there are exactly two of those, so it holds at
 * most two entries per screen for the life of the process.
 */
export function createStyles<T extends NamedStyles<T>>(factory: (theme: Theme) => T) {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let sheet = cache.get(theme);
    if (sheet === undefined) {
      sheet = StyleSheet.create(factory(theme));
      cache.set(theme, sheet);
    }
    return sheet;
  };
}

/** The defaults, for the rare caller that needs them before the provider mounts. */
export { DEFAULT_SETTINGS };
