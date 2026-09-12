/**
 * The design tokens. Two palettes, one type scale, one spacing scale, one set of radii.
 *
 * **Warm identity, modern build.** The wood brown of the Boydem mark stays — this app is a
 * cupboard you put things in, and a cold grey product does not say that. What changed is
 * everything around it, because "warm" was doing the work that structure should have been
 * doing: near-identical paper and panel greys meant a card was distinguishable from the page
 * only if you looked for it, so screens compensated with more cards, and the result read as
 * cute rather than considered.
 *
 * The rules now:
 *
 * - **Surfaces separate by lightness, not by hue.** `card` is white on a warm-tinted `paper`
 *   in the light theme, and genuinely lifted in the dark one. A card no longer needs a border
 *   to be found.
 * - **Colour is information, never decoration.** `accent` marks the one interactive thing on a
 *   screen and the number that is the point of it. `good` says what the archive holds, `bad`
 *   what it does not, `caution` is the single "look before you act". Nothing decorative may
 *   use any of them — on the Verify screen those colours are load-bearing.
 * - **`separator` divides rows inside a group; `hairline` outlines a shape.** They are close in
 *   value and different in job, and using one for the other is what makes a list look noisy.
 *
 * **The dark palette is not the light one inverted.** Wood brown at #7a4a21 has nowhere near
 * enough contrast on a dark ground, so the dark theme raises the accent to a warm tan that
 * keeps the identity and clears WCAG AA against `paper`. The same lift applies to `good` and
 * `bad`, whose light values are chosen to sit on paper.
 *
 * Every screen reads these through `useTheme()` (`components/app/providers.tsx`) rather than
 * importing a palette directly, and builds its styles with `createStyles` so that switching
 * appearance restyles the app without a reload.
 */

import type { TextStyle } from "react-native";

export interface Theme {
  /** True when this is the dark palette. Drives `StatusBar` and `keyboardAppearance`. */
  readonly dark: boolean;
  /** The page ground. */
  readonly paper: string;
  /** A card or grouped-row surface sitting on `paper`. */
  readonly panel: string;
  /** A surface that should read as lifted *above* `panel` — message bubbles, the tab bar. */
  readonly raised: string;
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
  /** The outline of a shape — a card's edge, a field's border, the tab bar's top. */
  readonly hairline: string;
  /** The line *between rows inside* a group. Lighter than `hairline`, and not interchangeable. */
  readonly separator: string;
  /** Wood brown. Interactive elements, and numbers that are the point. */
  readonly accent: string;
  /** The lighter wood tone, for a second accented thing beside the first. */
  readonly accentSoft: string;
  /** A tinted ground for an accented chip or a selected row. */
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
  /** Fill for a message bubble the reader sent themselves. */
  readonly selfBubble: string;
  /** Text input grounds, which must not disappear into `panel`. */
  readonly field: string;
  /** The dimming behind a sheet or a lightbox. */
  readonly scrim: string;
}

export const lightTheme: Theme = {
  dark: false,
  paper: "#f7f4f0",
  panel: "#ffffff",
  raised: "#ffffff",
  sunken: "#ece7e0",
  ink: "#17140f",
  body: "#3b352d",
  muted: "#6f675c",
  faint: "#948b7e",
  hairline: "#e3ddd3",
  separator: "#efeae2",
  accent: "#8a4b1c",
  accentSoft: "#a9682f",
  accentWash: "#f4e9de",
  onAccent: "#ffffff",
  good: "#1f6b48",
  goodWash: "#e8f1ec",
  bad: "#a3341f",
  badWash: "#faeeeb",
  caution: "#8a6d1f",
  cautionWash: "#f6efdc",
  selfBubble: "#f0e3d4",
  field: "#ffffff",
  scrim: "rgba(23, 20, 15, 0.45)",
};

/**
 * The dark counterpart.
 *
 * Grounds are warm rather than pure black — the same reasoning as the light theme's paper: this
 * app is either showing a chat or making a claim about one, and neither reads well on something
 * that looks like a terminal. `panel` and `raised` are genuinely lighter than `paper` here,
 * because in the dark the convention inverts: elevation adds light rather than shadow.
 */
export const darkTheme: Theme = {
  dark: true,
  paper: "#121010",
  panel: "#1c1917",
  raised: "#262220",
  sunken: "#0c0a0a",
  ink: "#f5f2ed",
  body: "#ddd6cc",
  muted: "#a09789",
  faint: "#7c7367",
  hairline: "#332e29",
  separator: "#282320",
  accent: "#e0a06a",
  accentSoft: "#bd8250",
  accentWash: "#2b211a",
  onAccent: "#1a120b",
  good: "#5fc792",
  goodWash: "#15271e",
  bad: "#f38f75",
  badWash: "#2c1a16",
  caution: "#dcb85c",
  cautionWash: "#2a2213",
  selfBubble: "#3a2d22",
  field: "#231f1c",
  scrim: "rgba(0, 0, 0, 0.6)",
};

/**
 * The type scale. Seven steps, and screens use nothing else.
 *
 * Before this there were 11px, 11.5px, 12px, 12.5px, 13px, 13.5px, 14px, 14.5px, 15px, 16px,
 * 16.5px, 17px, 20px, 22px and 24px across the app, most of them a hair apart, which is a
 * hierarchy the eye cannot read — and it is the main reason the screens looked hand-assembled.
 * These steps are far enough apart to mean something.
 *
 * `display` and `title` carry slight negative tracking, which large text needs in both scripts.
 * `micro` carries positive tracking, which small all-caps-ish labels need in Latin and which
 * Hebrew tolerates. Nothing in between is tracked: Hebrew has no case, so a Latin designer's
 * habit of letterspacing mid-size labels just loosens the words.
 */
export const type = {
  /** A screen's own headline, when the screen is the whole point (Verify, an empty library). */
  display: { fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
  /** A heading inside a screen, and a chat's name. */
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3 },
  /** A card's heading, a topic in Help. */
  heading: { fontSize: 17, lineHeight: 23, fontWeight: "600", letterSpacing: -0.1 },
  /** Body copy that is the screen's content — instructions, an explanation. */
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  /** A row's label, a button, anything tappable. Never smaller than this. */
  label: { fontSize: 16, lineHeight: 21, fontWeight: "500" },
  /** Supporting copy: a note under a row, a footnote under a section. */
  caption: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  /** A timestamp, a unit, a section's eyebrow. The floor — nothing smaller ships. */
  micro: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.2 },
} as const satisfies Record<string, TextStyle>;

/**
 * The corner radii.
 *
 * Bigger than they were (`card` was 12), because a 12pt corner on a full-width card reads as a
 * rounded rectangle while an 18pt one reads as a surface — and `pill` is what a status chip
 * should always have been.
 */
export const radius = { field: 14, button: 16, chip: 12, card: 18, sheet: 28, pill: 999 } as const;

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

/** The side margin every screen shares. */
export const gutter = space.xl;

/**
 * The minimum height of anything tappable. Apple asks for 44, Android for 48; 48 satisfies both
 * and is also simply easier to hit, which matters more than the guideline does.
 */
export const TAP = 48;
