import { getShareExtensionKey } from "expo-share-intent";

/**
 * Deep-link rewriting, run by expo-router before it matches a URL to a route.
 *
 * The iOS Share Extension does not hand the file to us directly — it writes it into the App
 * Group container and reopens the host app with a URL of the shape
 * `chatvault://dataUrl=chatvaultShareKey`. That is a signal, not a path: no route in `app/`
 * matches it, so without this hook expo-router falls through to its "Unmatched Route" screen
 * and the share appears to have failed, even though the handoff worked and the file is
 * already on disk.
 *
 * So we rewrite it to `/import`, and `ShareIntentRouter` in `_layout.tsx` then fills in the
 * file's path and metadata from `useShareIntentContext` once the provider has read them.
 *
 * Android sends a normal `ACTION_SEND` intent rather than this URL, and needs no rewrite.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return "/import";
    return path;
  } catch {
    // A malformed or unexpected URL must never strand the user on an error screen — send
    // them to the library, which explains how to produce an export.
    return "/";
  }
}
