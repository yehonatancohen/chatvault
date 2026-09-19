/**
 * The design tokens. Two palettes, one type scale, one spacing scale, one set of radii.
 *
 * **Boydem speaks like a well-made public sign** (redesign, owner, 2026-09-17: only the name
 * stays). Israeli modernist signage is the model: flat fields of one strong colour, one solid
 * pictogram per idea, and numbers set big enough to be read from across a room. The app is
 * still an iPhone app first — structure, navigation and controls stay native — so the sign
 * language lives in the layer iOS leaves open: tint, a few full-colour moments, and type.
 *
 * The rules:
 *
 * - **Ultramarine is the brand, and it floods rather than sprinkles.** `sign` is a whole field
 *   — the tutorial, the Verify proof, the sign-in moment — never a thin accent scattered over
 *   grey. `accent` is the same hue as the iOS tint: links, switches, the selected tab.
 * - **Orange is the one thing to press.** `signal` fills the primary button, with ink on it:
 *   white on that orange fails contrast, and black on orange is how a road sign does it anyway.
 * - **Yellow is the one thing to look at.** `sun` marks "safe to delete" and the tutorial's
 *   callout rings. Nothing else is yellow.
 * - **`good`/`bad`/`caution` stay information.** Verify and the delete guide depend on them.
 * - **Surfaces separate by lightness, as iOS grouped lists do.** Cool grey page, white cells.
 *
 * **The dark palette is not the light one inverted.** Ultramarine text disappears on a dark
 * ground, so `accent` lifts to a periwinkle that clears AA, while the `sign` field keeps its
 * full depth — a field is a surface, and white type on it reads the same in both themes.
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
  /** The iOS tint: links, switches, the selected tab, a chevron that leads somewhere. */
  readonly accent: string;
  /** A lighter tint, for a second accented thing beside the first. */
  readonly accentSoft: string;
  /** A tinted ground for an accented chip or a selected row. */
  readonly accentWash: string;
  /** Text drawn *on* `accent` — not `paper`, which is wrong in the dark theme. */
  readonly onAccent: string;
  /** Ultramarine as a whole field: the tutorial, the Verify proof, the sign-in moment. */
  readonly sign: string;
  /** Type on `sign`. */
  readonly onSign: string;
  /** Secondary type on `sign` — tinted from the field, never grey. */
  readonly onSignMuted: string;
  /** The primary button's fill. One per screen. */
  readonly signal: string;
  /** Type on `signal`. Ink, not white: white on this orange fails contrast. */
  readonly onSignal: string;
  /** "Look here": the safe-to-delete plate and the tutorial's callout rings. */
  readonly sun: string;
  /** Type on `sun`. */
  readonly onSun: string;
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
  paper: "#f2f3f7",
  panel: "#ffffff",
  raised: "#ffffff",
  sunken: "#e4e6ee",
  ink: "#111114",
  body: "#2c2e36",
  muted: "#555864",
  faint: "#6c6f7b",
  hairline: "#d9dce5",
  separator: "#e4e6ee",
  accent: "#2436c9",
  accentSoft: "#5363e0",
  accentWash: "#e6e9fb",
  onAccent: "#ffffff",
  sign: "#2436c9",
  onSign: "#ffffff",
  onSignMuted: "#cdd3fa",
  signal: "#ff5b24",
  onSignal: "#111114",
  sun: "#ffd23f",
  onSun: "#111114",
  good: "#0d7a48",
  goodWash: "#e1f3ea",
  bad: "#c23220",
  badWash: "#fbe9e6",
  caution: "#855f00",
  cautionWash: "#fbf0d2",
  selfBubble: "#dfe4fc",
  field: "#ffffff",
  scrim: "rgba(10, 12, 30, 0.45)",
};

/**
 * The dark counterpart: blue-black grounds, because this app's colour is ultramarine and a
 * neutral black under it reads as a different product. `panel` and `raised` are lighter than
 * `paper`, since in the dark elevation adds light rather than shadow.
 */
export const darkTheme: Theme = {
  dark: true,
  paper: "#0b0d16",
  panel: "#161a27",
  raised: "#1f2433",
  sunken: "#05060b",
  ink: "#f3f4f8",
  body: "#d5d8e1",
  muted: "#a2a6b4",
  faint: "#868a99",
  hairline: "#2a2f40",
  separator: "#212636",
  accent: "#97a3ff",
  accentSoft: "#6f7cf0",
  accentWash: "#1a2050",
  onAccent: "#0b0d16",
  sign: "#2436c9",
  onSign: "#ffffff",
  onSignMuted: "#cdd3fa",
  signal: "#ff6a36",
  onSignal: "#111114",
  sun: "#ffd23f",
  onSun: "#111114",
  good: "#4fd08f",
  goodWash: "#0e281c",
  bad: "#ff8b75",
  badWash: "#2d1512",
  caution: "#efc24f",
  cautionWash: "#2a220c",
  selfBubble: "#252c5c",
  field: "#161a27",
  scrim: "rgba(0, 0, 0, 0.6)",
};

/**
 * The display face: Secular One, a heavy geometric Hebrew sign face with Latin to match. Loaded
 * at launch from `assets/fonts` (`app/_layout.tsx`). It has one weight, so styles that use it
 * set `fontWeight: "400"` — asking iOS for a bolder cut of a single-weight custom face makes it
 * fall back to the system font.
 *
 * Display moments only: a tutorial title, the numbers on Verify, an empty screen's headline.
 * Everything a user reads or taps stays in San Francisco, which follows their text size.
 */
export const DISPLAY_FONT = "SecularOne";

/**
 * The type scale, on Apple's text styles. Seven steps for UI, plus two display steps.
 *
 * `display` and `numeral` are the sign voice. The rest match iOS's own sizes (Title 2, Headline,
 * Body, Subheadline, Footnote), so a Boydem screen sits beside Settings and Mail at the same
 * reading size and grows with Dynamic Type like they do.
 */
export const type = {
  /** A sign: the numbers on Verify. */
  numeral: { fontFamily: DISPLAY_FONT, fontSize: 60, lineHeight: 64, fontWeight: "400" },
  /** A screen's headline when the screen is the whole point (tutorial, an empty library). */
  display: { fontFamily: DISPLAY_FONT, fontSize: 32, lineHeight: 38, fontWeight: "400" },
  /** A heading inside a screen, and a chat's name. */
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3 },
  /** A card's heading, a topic in Help, a chat row's name. */
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  /** Body copy that is the screen's content — instructions, an explanation. */
  body: { fontSize: 17, lineHeight: 24, fontWeight: "400" },
  /** A row's label, a button, anything tappable. Never smaller than this. */
  label: { fontSize: 17, lineHeight: 22, fontWeight: "400" },
  /** Supporting copy: a note under a row, a chat's last message. */
  caption: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  /** A timestamp, a unit, a section's heading. The floor — nothing smaller ships. */
  micro: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
} as const satisfies Record<string, TextStyle>;

/**
 * The corner radii. Two families: iOS's continuous rounding for things you tap and group
 * (`field`, `button`, `card`, `sheet`), and a near-square `plate` for signs — a step number, a
 * status mark — because a sign's corners are cut, not moulded.
 */
export const radius = { plate: 4, chip: 8, field: 12, button: 14, card: 14, sheet: 22, pill: 999 } as const;

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
