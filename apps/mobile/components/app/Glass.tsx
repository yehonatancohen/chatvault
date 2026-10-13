/**
 * Liquid Glass — the system's own material, for the layer that floats above content.
 *
 * **What gets glass, and what never does** (Apple's guidance, developer.apple.com/design →
 * "Liquid Glass", followed here rather than interpreted):
 *
 * - Glass is for **controls and navigation that sit over content**: the tab bar, a floating
 *   button, the one primary action. It is how the system says "this is above what you are
 *   reading, and you can act on it".
 * - **Content is never glass.** A list's cells, a message bubble, a paragraph — those are what
 *   the glass floats over. A cell made of glass has nothing behind it to refract and reads as a
 *   washed-out card.
 * - **No glass on glass.** A glass control inside a glass bar is a plain shape on that bar.
 * - **Tint is for the primary action only.** Everything else is clear ("regular") glass and takes
 *   its colour from whatever is under it.
 *
 * **This is the real material, not a picture of it.** `GlassView` is `UIGlassEffect` — it
 * refracts what scrolls beneath it, reacts to touch when `interactive`, and already honours
 * Reduce Transparency and Increase Contrast, which no translucent `View` would.
 *
 * **Why this needed no new native build.** `expo-glass-effect` is a dependency of `expo-router`,
 * so it was already compiled into every build that takes this app's JS over the air; naming it in
 * `package.json` only lets Metro resolve it (see the `comment` there). It is still loaded
 * defensively: a missing native module would otherwise throw while the tab bar renders, which is
 * to say at launch.
 *
 * **Where there is no Liquid Glass** — iOS before 26, Android, a binary without the module —
 * `Glass` is an ordinary view carrying `fallbackStyle`: the opaque system material the app used
 * before, so nothing depends on a blur that is not there.
 */

import type { ReactNode } from "react";
import { Platform, View, type ColorValue, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { useTheme } from "./providers";

type GlassModule = typeof import("expo-glass-effect");

let loaded: GlassModule | null | undefined;

function load(): GlassModule | null {
  if (loaded !== undefined) return loaded;
  loaded = null;
  if (Platform.OS !== "ios") return loaded;
  try {
    // `require`, not `import`: the module asks for its native view at the top of the file, and a
    // binary without it must fall back rather than fail to start.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const glass = require("expo-glass-effect") as GlassModule;
    // Both checks: the first is the design being in use at all, the second guards the early
    // iOS 26 builds where the effect's API exists in name and crashes when asked for.
    if (glass.isLiquidGlassAvailable() && glass.isGlassEffectAPIAvailable()) loaded = glass;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** True when `Glass` will draw the system material rather than its fallback. */
export function hasLiquidGlass(): boolean {
  return load() !== null;
}

export function Glass({
  children,
  style,
  fallbackStyle,
  tint,
  interactive = false,
  ...rest
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Added to `style` only where there is no Liquid Glass: the surface's opaque stand-in. */
  fallbackStyle?: StyleProp<ViewStyle>;
  /** A tint through the glass. For the primary action; leave it off everything else. */
  tint?: ColorValue | undefined;
  /** The material lifts and shimmers under a touch. For something pressable. */
  interactive?: boolean;
} & Omit<ViewProps, "style" | "children">) {
  const theme = useTheme();
  const glass = load();

  if (glass === null) {
    return (
      <View style={[style, fallbackStyle]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <glass.GlassView
      style={style}
      glassEffectStyle="regular"
      // The app has its own Light/Dark setting; left on "auto" the glass would follow the phone
      // and sit light over a dark app.
      colorScheme={theme.dark ? "dark" : "light"}
      isInteractive={interactive}
      {...(tint !== undefined ? { tintColor: tint } : {})}
      {...rest}
    >
      {children}
    </glass.GlassView>
  );
}
