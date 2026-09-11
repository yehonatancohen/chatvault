/**
 * Layout direction, decided before React renders.
 *
 * `I18nManager.forceRTL` is a native flag, not a React value. It is read when the view
 * hierarchy is created, so calling it from inside a component sets a flag that only takes
 * effect on the *next* launch — the app you are looking at keeps the direction it started
 * with. That is why this module exists and why `app/_layout.tsx` imports it first, before any
 * component: at import time nothing has rendered yet, so a cold start already knows which way
 * round it is.
 *
 * The consequence for the Settings screen is unavoidable and must be stated in the UI rather
 * than hidden: **switching between Hebrew and English needs the app relaunched** before the
 * layout flips. Text changes immediately (that part is React); mirroring does not. Every RN app
 * that supports RTL has this constraint, and pretending otherwise produces a half-mirrored
 * screen, which is worse than asking.
 *
 * `allowRTL(true)` is set unconditionally so that `forceRTL` is honoured at all — without it
 * the native side ignores the request on a device whose system language is LTR, which is most
 * of the phones this will run on.
 */

import { I18nManager } from "react-native";
import { readSettingsSync, type Language } from "../settings/settings";

export function isRTLLanguage(language: Language): boolean {
  return language === "he";
}

/**
 * True when the running app's direction does not match the chosen language — i.e. the user has
 * changed language and the relaunch has not happened yet. The Settings screen reads this to
 * decide whether to show the "restart to finish" notice, so the notice appears exactly when it
 * is true and disappears by itself after the relaunch.
 */
export function directionNeedsRestart(language: Language): boolean {
  return I18nManager.isRTL !== isRTLLanguage(language);
}

/** Called once, at import, from `app/_layout.tsx`. Safe to call again; it is idempotent. */
export function applyLayoutDirection(): void {
  const wanted = isRTLLanguage(readSettingsSync().language);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== wanted) I18nManager.forceRTL(wanted);
}

applyLayoutDirection();
