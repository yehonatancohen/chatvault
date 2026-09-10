/**
 * One palette, so the screens agree.
 *
 * The colours were already repeated verbatim across `index.tsx` and `import.tsx` before there
 * were more than two screens; this is that set, named. Warm paper rather than white, because
 * every screen in this app is either a chat or a claim about a chat, and both read better on
 * something that is not a spreadsheet.
 *
 * The neutrals are the wood-brown warm set from the Boydem design (`Boydem.dc.html`, light
 * variant) — pulled toward the cabinet mark rather than sitting neutral beside it. `accent`
 * is the wood brown itself, for the one interactive thing on a screen and for a number that
 * is the whole point of a screen; `accentSoft` is its lighter partner.
 *
 * `good` and `bad` are used for exactly one thing each: `good` for what the archive holds, and
 * `bad` for what it does not. Nothing decorative is allowed to use them — on the Verify screen
 * those two colours are load-bearing information. They are deliberately left as they were: the
 * restyle is the neutrals, not the signal colours.
 */

export const theme = {
  paper: "#f6f4f1",
  panel: "#efece6",
  ink: "#141310",
  body: "#2e2c28",
  muted: "#6c6a65",
  hairline: "#e5e1da",
  /** Wood brown. The accent from the mark — interactive elements, and numbers that are the point. */
  accent: "#7a4a21",
  /** The lighter wood tone, for a second accented thing beside the first. */
  accentSoft: "#9a6534",
  /** A warm off-white for raised surfaces (message rows, cards) that sit on `paper`. */
  raised: "#ffffff",
  good: "#256d4a",
  bad: "#a3341f",
  /** The one warning colour that is not a failure — "look at this before you act". */
  caution: "#8a6d1f",
} as const;

export const radius = { card: 12, chip: 8 } as const;
