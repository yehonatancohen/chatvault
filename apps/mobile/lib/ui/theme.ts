/**
 * Two palettes, so the screens agree in either appearance.
 *
 * The light neutrals are the wood-brown warm set from the Boydem design (`Boydem.dc.html`,
 * light variant) — pulled toward the cabinet mark rather than sitting neutral beside it.
 * `accent` is the wood brown itself, for the one interactive thing on a screen and for a number
 * that is the whole point of a screen; `accentSoft` is its lighter partner.
 *
 * **The dark palette is not the light one inverted.** Wood brown at #7a4a21 is unreadable on a
 * dark ground — it has nowhere near enough contrast — so the dark theme raises the accent to a
 * warm tan that keeps the identity and clears WCAG AA against `paper`. The same applies to
 * `good` and `bad`: the light values are chosen to sit on paper, and both are lifted here.
 *
 * `good` and `bad` are used for exactly one thing each: `good` for what the archive holds, and
 * `bad` for what it does not. Nothing decorative is allowed to use them — on the Verify screen
 * those two colours are load-bearing information.
 *
 * Every screen reads these through `useTheme()` (`components/app/providers.tsx`) rather than
 * importing a palette directly, and builds its styles with `createStyles` so that switching
 * appearance restyles the app without a reload.
 */

export interface Theme {
  /** True when this is the dark palette. Drives `StatusBar` and `keyboardAppearance`. */
  readonly dark: boolean;
  /** The page ground. */
  readonly paper: string;
  /** A card or grouped-row surface sitting on `paper`. */
  readonly panel: string;
  /** A surface that should read as lifted *above* `panel` — message bubbles, the tab bar. */
  readonly raised: string;
  /** Primary text. */
  readonly ink: string;
  /** Body copy. */
  readonly body: string;
  /** Secondary text, labels, and anything the eye should reach second. */
  readonly muted: string;
  readonly hairline: string;
  /** Wood brown. Interactive elements, and numbers that are the point. */
  readonly accent: string;
  /** The lighter wood tone, for a second accented thing beside the first. */
  readonly accentSoft: string;
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
  /** Fill for a message bubble the reader sent themselves. */
  readonly selfBubble: string;
  /** Text input grounds, which must not disappear into `panel`. */
  readonly field: string;
}

export const lightTheme: Theme = {
  dark: false,
  paper: "#f6f4f1",
  panel: "#efece6",
  raised: "#ffffff",
  ink: "#141310",
  body: "#2e2c28",
  muted: "#6c6a65",
  hairline: "#e5e1da",
  accent: "#7a4a21",
  accentSoft: "#9a6534",
  onAccent: "#f6f4f1",
  good: "#256d4a",
  goodWash: "#eef4f0",
  bad: "#a3341f",
  badWash: "#fbf1ee",
  caution: "#8a6d1f",
  selfBubble: "#efe1d1",
  field: "#ffffff",
};

/**
 * The dark counterpart.
 *
 * Grounds are warm rather than pure black — the same reasoning as the light theme's paper: this
 * app is either showing a chat or making a claim about one, and neither reads well on something
 * that looks like a terminal. `raised` is genuinely lighter than `panel` here, because in the
 * dark the convention is inverted: elevation adds light rather than shadow.
 */
export const darkTheme: Theme = {
  dark: true,
  paper: "#14120f",
  panel: "#1f1c18",
  raised: "#2a2520",
  ink: "#f4f1ec",
  body: "#ddd7ce",
  muted: "#9c948a",
  hairline: "#332e28",
  accent: "#d79a63",
  accentSoft: "#b87f4c",
  onAccent: "#1a140e",
  good: "#5cc08d",
  goodWash: "#16261e",
  bad: "#f08a70",
  badWash: "#2b1a16",
  caution: "#d9b455",
  selfBubble: "#3d3025",
  field: "#26221d",
};

export const radius = { card: 12, chip: 8 } as const;

/**
 * One spacing scale, so padding stops being invented per screen.
 *
 * Screens were each choosing their own 4/6/8/10/14/16/18/20/24, which is the main reason the
 * app looked hand-assembled rather than designed. These are the only values that should appear.
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
