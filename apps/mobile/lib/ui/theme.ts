/**
 * One palette, so the screens agree.
 *
 * The colours were already repeated verbatim across `index.tsx` and `import.tsx` before there
 * were more than two screens; this is that set, named. Warm paper rather than white, because
 * every screen in this app is either a chat or a claim about a chat, and both read better on
 * something that is not a spreadsheet.
 *
 * `good` and `bad` are used for exactly one thing each: `good` for what the archive holds, and
 * `bad` for what it does not. Nothing decorative is allowed to use them — on the Verify screen
 * those two colours are load-bearing information.
 */

export const theme = {
  paper: "#faf9f6",
  panel: "#f3f1ec",
  ink: "#1c1b19",
  body: "#4a4842",
  muted: "#6b6862",
  hairline: "#ddd9d1",
  good: "#256d4a",
  bad: "#a3341f",
  /** The one warning colour that is not a failure — "look at this before you act". */
  caution: "#8a6d1f",
} as const;

export const radius = { card: 12, chip: 8 } as const;
