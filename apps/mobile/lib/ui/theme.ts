/**
 * The design tokens. Two palettes, one type scale, one spacing scale, one set of radii.
 *
 * **Boydem follows Apple's Human Interface Guidelines** (owner, 2026-10-03, replacing the
 * 2026-09-17 "public sign" system). The app should look like it shipped with the phone: the
 * system's semantic colours, San Francisco on Apple's text styles, inset grouped lists, one
 * tint. Nothing here is a brand colour — the mark is the brand, and it lives in the icon.
 *
 * The rules:
 *
 * - **One tint, and it means "you can act on this".** `accent` is system blue: links, switches,
 *   the selected tab, and the fill of the one primary button. Nothing decorative is blue.
 * - **Colour is information.** `good`/`bad`/`caution` are the system green, red and orange — in
 *   the light palette their accessible (Increase Contrast) variants, because they are set as
 *   text on Verify and in a chat's status, and the standard light green fails contrast as type.
 * - **Surfaces are the system's grouped backgrounds.** `paper` is the grouped page, `panel` the
 *   cell on it; `base` is the plain system background, for a screen that is content rather than
 *   a form (the chat reader).
 * - **A pressed row goes grey, not blue** (`highlight`), as a system cell does.
 *
 * **The dark palette is the system's own dark values**, not the light one inverted: a true black
 * page with lifted cells, and each hue's dark variant.
 *
 * Every screen reads these through `useTheme()` (`components/app/providers.tsx`) rather than
 * importing a palette directly, and builds its styles with `createStyles` so that switching
 * appearance restyles the app without a reload.
 */

import type { TextStyle } from "react-native";

export interface Theme {
  /** True when this is the dark palette. Drives `StatusBar` and `keyboardAppearance`. */
  readonly dark: boolean;
  /** The grouped page ground (`systemGroupedBackground`). */
  readonly paper: string;
  /** The plain page ground (`systemBackground`) — a screen of content, not of groups. */
  readonly base: string;
  /** A card or grouped-row surface sitting on `paper`. */
  readonly panel: string;
  /** A surface that should read as lifted *above* `panel` — a sheet, a chip on a cell. */
  readonly raised: string;
  /** A row while it is pressed. Grey in both palettes, the way a system cell highlights. */
  readonly highlight: string;
  /** A recessed ground — a field's well, a track behind a progress bar, an empty slot. */
  readonly sunken: string;
  /** Primary text. */
  readonly ink: string;
  /** Body copy. */
  readonly body: string;
  /** Secondary text, labels, and anything the eye should reach second. */
  readonly muted: string;
  /** Third-rank text: a timestamp, a unit, a count beside something that matters more. */
  readonly faint: string;
  /** The outline of a shape — a field's border, the tab bar's top. */
  readonly hairline: string;
  /** The line *between rows inside* a group. Lighter than `hairline`, and not interchangeable. */
  readonly separator: string;
  /** The iOS tint: links, switches, the selected tab, the primary button's fill. */
  readonly accent: string;
  /** A lighter tint, for a second accented thing beside the first. */
  readonly accentSoft: string;
  /** A tinted ground for a secondary button or an accented chip. */
  readonly accentWash: string;
  /** Text drawn *on* `accent` — not `paper`, which is wrong in the dark theme. */
  readonly onAccent: string;
  readonly good: string;
  /** A tinted ground for a `good` box. */
  readonly goodWash: string;
  readonly bad: string;
  /** A tinted ground for a `bad` box. */
  readonly badWash: string;
  /** The one warning colour that is not a failure — "look at this before you act". */
  readonly caution: string;
  /** A tinted ground for a `caution` box. */
  readonly cautionWash: string;
  /** Fill for a message bubble someone else sent. */
  readonly bubble: string;
  /** Fill for a message bubble the reader sent themselves. */
  readonly selfBubble: string;
  /** Type on `selfBubble`. */
  readonly onSelfBubble: string;
  /** Secondary type on `selfBubble` — a timestamp. */
  readonly onSelfBubbleMuted: string;
  /** Text input grounds, which must not disappear into `panel`. */
  readonly field: string;
  /** The dimming behind a sheet or a lightbox. */
  readonly scrim: string;
}

export const lightTheme: Theme = {
  dark: false,
  paper: "#f2f2f7",
  base: "#ffffff",
  panel: "#ffffff",
  raised: "#ffffff",
  highlight: "#d1d1d6",
  sunken: "#e5e5ea",
  ink: "#000000",
  body: "#000000",
  muted: "#6c6c70",
  faint: "#8e8e93",
  hairline: "#c6c6c8",
  separator: "rgba(60, 60, 67, 0.29)",
  accent: "#007aff",
  accentSoft: "#5ac8fa",
  accentWash: "rgba(0, 122, 255, 0.12)",
  onAccent: "#ffffff",
  good: "#248a3d",
  goodWash: "rgba(52, 199, 89, 0.14)",
  bad: "#d70015",
  badWash: "rgba(255, 59, 48, 0.12)",
  caution: "#c93400",
  cautionWash: "rgba(255, 149, 0, 0.14)",
  bubble: "#e9e9eb",
  selfBubble: "#007aff",
  onSelfBubble: "#ffffff",
  onSelfBubbleMuted: "rgba(255, 255, 255, 0.75)",
  field: "#ffffff",
  scrim: "rgba(0, 0, 0, 0.4)",
};

/**
 * The dark counterpart: the system's dark values. `panel` and `raised` are lighter than `paper`,
 * since in the dark elevation adds light rather than shadow.
 */
export const darkTheme: Theme = {
  dark: true,
  paper: "#000000",
  base: "#000000",
  panel: "#1c1c1e",
  raised: "#2c2c2e",
  highlight: "#3a3a3c",
  sunken: "#2c2c2e",
  ink: "#ffffff",
  body: "#ffffff",
  muted: "#aeaeb2",
  faint: "#8e8e93",
  hairline: "#38383a",
  separator: "rgba(84, 84, 88, 0.6)",
  accent: "#0a84ff",
  accentSoft: "#64d2ff",
  accentWash: "rgba(10, 132, 255, 0.2)",
  onAccent: "#ffffff",
  good: "#30d158",
  goodWash: "rgba(48, 209, 88, 0.18)",
  bad: "#ff453a",
  badWash: "rgba(255, 69, 58, 0.18)",
  caution: "#ff9f0a",
  cautionWash: "rgba(255, 159, 10, 0.18)",
  bubble: "#262629",
  selfBubble: "#0a84ff",
  onSelfBubble: "#ffffff",
  onSelfBubbleMuted: "rgba(255, 255, 255, 0.75)",
  field: "#1c1c1e",
  scrim: "rgba(0, 0, 0, 0.6)",
};

/**
 * The type scale: Apple's text styles, under this app's own step names.
 *
 * San Francisco throughout — there is no custom face. Each step is one of the system's styles at
 * its default size (Large Title, Title 2, Headline, Body, Subheadline, Footnote), so a Boydem
 * screen sits beside Settings and Mail at the same reading size and grows with Dynamic Type like
 * they do.
 */
export const type = {
  /** A count that is the point of the screen (Verify). Large Title's size, tabular figures. */
  numeral: { fontSize: 34, lineHeight: 41, fontWeight: "700", fontVariant: ["tabular-nums"] },
  /** Large Title: a top-level screen's name, a welcome headline. */
  display: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: 0.4 },
  /** Title 2: a heading inside a screen, and a chat's name. */
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3 },
  /** Headline: a card's heading, a chat row's name, a stack header's title. */
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  /** Body: copy that is the screen's content — instructions, an explanation. */
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400" },
  /** Body, as a row's label, a button, anything tappable. Never smaller than this. */
  label: { fontSize: 17, lineHeight: 22, fontWeight: "400" },
  /** Subheadline: supporting copy — a note under a row, a chat's last message. */
  caption: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  /** Footnote: a timestamp, a unit, a section's heading. The floor — nothing smaller ships. */
  micro: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
} as const satisfies Record<string, TextStyle>;

/**
 * The corner radii, all continuous. `card` is an inset grouped list's corner, `button` a capsule
 * (a full-width button's label is one line, so the pill radius is safe), `sheet` a sheet's top.
 */
export const radius = { chip: 8, field: 12, button: 999, card: 20, sheet: 28, pill: 999 } as const;

/**
 * One spacing scale, so padding stops being invented per screen.
 *
 * Screens were each choosing their own 4/6/8/10/14/16/18/20/24, which is the other half of why
 * the app looked assembled rather than designed. These are the only values that should appear.
 * `gutter` is the one exception with a name rather than a size: it is the screen's side margin,
 * and every screen uses it so that nothing is ever a few points out of line with the screen
 * above it.
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** The side margin every screen shares — the system's own list margin. */
export const gutter = space.lg;

/**
 * The minimum height of anything tappable. Apple asks for 44, Android for 48; 48 satisfies both
 * and is also simply easier to hit, which matters more than the guideline does.
 */
export const TAP = 48;
