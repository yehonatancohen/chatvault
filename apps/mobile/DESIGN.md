---
name: Boydem (בוידעם) — iOS app
description: Apple's Human Interface Guidelines, applied plainly; system colours, San Francisco, inset grouped lists, one tint, in Hebrew and English.
colors:
  accent: "#007aff"
  accent-soft: "#5ac8fa"
  accent-wash: "rgba(0, 122, 255, 0.12)"
  on-accent: "#ffffff"
  paper: "#f2f2f7"
  base: "#ffffff"
  panel: "#ffffff"
  raised: "#ffffff"
  highlight: "#d1d1d6"
  sunken: "#e5e5ea"
  field: "#ffffff"
  ink: "#000000"
  body: "#000000"
  muted: "#6c6c70"
  faint: "#8e8e93"
  hairline: "#c6c6c8"
  separator: "rgba(60, 60, 67, 0.29)"
  bubble: "#e9e9eb"
  self-bubble: "#007aff"
  on-self-bubble: "#ffffff"
  on-self-bubble-muted: "rgba(255, 255, 255, 0.75)"
  good: "#248a3d"
  good-wash: "rgba(52, 199, 89, 0.14)"
  bad: "#d70015"
  bad-wash: "rgba(255, 59, 48, 0.12)"
  caution: "#c93400"
  caution-wash: "rgba(255, 149, 0, 0.14)"
  scrim: "rgba(0, 0, 0, 0.4)"
  accent-dark: "#0a84ff"
  accent-soft-dark: "#64d2ff"
  accent-wash-dark: "rgba(10, 132, 255, 0.2)"
  on-accent-dark: "#ffffff"
  paper-dark: "#000000"
  base-dark: "#000000"
  panel-dark: "#1c1c1e"
  raised-dark: "#2c2c2e"
  highlight-dark: "#3a3a3c"
  sunken-dark: "#2c2c2e"
  field-dark: "#1c1c1e"
  ink-dark: "#ffffff"
  body-dark: "#ffffff"
  muted-dark: "#aeaeb2"
  faint-dark: "#8e8e93"
  hairline-dark: "#38383a"
  separator-dark: "rgba(84, 84, 88, 0.6)"
  bubble-dark: "#262629"
  self-bubble-dark: "#0a84ff"
  good-dark: "#30d158"
  good-wash-dark: "rgba(48, 209, 88, 0.18)"
  bad-dark: "#ff453a"
  bad-wash-dark: "rgba(255, 69, 58, 0.18)"
  caution-dark: "#ff9f0a"
  caution-wash-dark: "rgba(255, 159, 10, 0.18)"
  scrim-dark: "rgba(0, 0, 0, 0.6)"
typography:
  numeral:
    fontFamily: "SF Pro (system)"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
  display:
    fontFamily: "SF Pro (system)"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    letterSpacing: "0.4px"
  title:
    fontFamily: "SF Pro (system)"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.3px"
  heading:
    fontFamily: "SF Pro (system)"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "SF Pro (system)"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "SF Pro (system)"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "22px"
  caption:
    fontFamily: "SF Pro (system)"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
  micro:
    fontFamily: "SF Pro (system)"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
rounded:
  chip: "8px"
  field: "12px"
  card: "20px"
  sheet: "28px"
  button: "999px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
  gutter: "16px"
  tap: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 24px"
    height: "50px"
  button-quiet:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 24px"
    height: "50px"
  button-danger:
    backgroundColor: "{colors.bad-wash}"
    textColor: "{colors.bad}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 24px"
    height: "50px"
  section-group:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0 16px"
  row:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "12px 0"
    height: "48px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
    height: "50px"
  status-safe:
    backgroundColor: "{colors.good-wash}"
    textColor: "{colors.good}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
  step-disc:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    size: "28px"
  callout-good:
    backgroundColor: "{colors.good-wash}"
    textColor: "{colors.good}"
    rounded: "{rounded.card}"
    padding: "16px"
  callout-caution:
    backgroundColor: "{colors.caution-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  help-pill:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "48px"
  chat-row:
    textColor: "{colors.ink}"
    typography: "{typography.heading}"
    padding: "12px 16px"
    height: "76px"
  bubble-other:
    backgroundColor: "{colors.bubble}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  bubble-self:
    backgroundColor: "{colors.self-bubble}"
    textColor: "{colors.on-self-bubble}"
    typography: "{typography.body}"
  tab-bar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.faint}"
  step-shot:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
---

# Design System: Boydem (בוידעם) — iOS app

## Overview

**Creative North Star: "It Shipped With the Phone"**

The owner asked on 2026-10-03 for Apple's design (developer.apple.com/design). This replaces the
2026-09-17 "public sign" system — ultramarine fields, a signal-orange button, sun-yellow plates
and the Secular One display face are gone and should not be restored.

Boydem follows the Human Interface Guidelines plainly. It uses the system's semantic colours, San
Francisco on Apple's text styles, inset grouped lists, SF Symbols and one tint, so the app sits
beside Settings, Mail and Messages without announcing itself. The brand is the app icon, which
appears on the welcome page, the empty chat list and the sign-in screen, and nowhere else.

Colour is information. Blue is "you can act on this". Green, red and orange are reserved for
Verify, the delete guide and a chat's status. An ordinary state gets no colour at all. Dark mode is
the system's own dark palette, not the light one inverted.

**Key Characteristics:**
- System grouped backgrounds; inset grouped lists with 20pt continuous corners.
- One tint (system blue), one filled button per screen.
- San Francisco on Apple's text-style sizes; no custom font is loaded.
- Large titles on the three tabs; inline Headline titles on pushed screens.
- The chat reader looks like Messages: grey bubbles, the reader's own in the tint.
- Every size, gap and corner comes from `lib/ui/theme.ts`; nothing tappable under 48pt.
- No native code beyond what the installed builds already contain (see Constraints).

## Colors

### Tint
- **System Blue** (#007aff / dark #0a84ff): links, section actions, the selected tab, the primary
  button's fill, the selection circle, step discs, progress bars, the reader's own bubbles.
- **Tint Wash** (12% / dark 20% of the tint): the secondary (`quiet`) button and the help pill.

### Neutral
- **Grouped Page** (#f2f2f7 / dark #000000): every form-like screen's ground and its header.
- **Base** (#ffffff / dark #000000): a screen that is content rather than a form — the chat list
  and the chat reader.
- **Cell** (#ffffff / dark #1c1c1e): grouped sections, the tab bar, fields.
- **Raised** (#ffffff / dark #2c2c2e): a chip standing inside a bubble.
- **Highlight** (#d1d1d6 / dark #3a3a3c): a pressed row, and inactive page dots.
- **Sunken** (#e5e5ea / dark #2c2c2e): switch off-track, progress track, photo placeholders.
- **Ink / Body** (#000000 / dark #ffffff): primary text.
- **Muted** (#6c6c70 / dark #aeaeb2): secondary text — values in rows, notes, section headings.
- **Faint** (#8e8e93 / dark #8e8e93): timestamps, chevrons, placeholders, inactive tabs.
- **Hairline** (#c6c6c8 / dark #38383a): the outline of a shape; the tab bar's top.
- **Separator** (the system separator, translucent): the line between rows inside one group.
- **Bubble** (#e9e9eb / dark #262629): messages other people sent.
- **Scrim** (40% / dark 60% black): behind sheets.

### Information
- **Green** (#248a3d / dark #30d158) on a green wash: saved, "safe to delete".
- **Red** (#d70015 / dark #ff453a) on a red wash: destructive actions and real failures only.
- **Orange** (#c93400 / dark #ff9f0a) on an orange wash: look at this before you act.

The light values are the system hues' accessible (Increase Contrast) variants: these colours are
set as text, and the standard light green (#34c759) is about 2:1 on white.

### Named Rules
**The One Tint Rule.** Blue means interactive. Nothing decorative is blue, and nothing else is a
second accent.

**The One Filled Button Rule.** One filled (tint, white label) button per screen. Everything else
is `quiet` (tint wash, tint label) or `danger` (red wash, red label).

**The Information Colours Rule.** `good`, `bad` and `caution` carry meaning on Verify, the delete
guide and chat status. Nothing decorative uses them and a normal state gets no colour.

**The Grey Highlight Rule.** A pressed row turns grey, edge to edge, as a system cell does — never
the tint.

**The Switch Is Green Rule.** A switch's "on" track is the system green, not the tint.

## Typography

**Font:** San Francisco (the system font), for everything. No font file ships with the app.

### Hierarchy
- **Display** (700, 34/41): Large Title — a tab's name, the tutorial's welcome headline.
- **Numeral** (700, 34/41, tabular figures): the counts on Verify.
- **Title** (700, 22/28): Title 2 — a screen heading, an empty state's headline.
- **Heading** (600, 17/22): Headline — a navigation bar's inline title, a chat row's name, a
  callout title.
- **Body** (400, 17/22): instructions, explanations, a message.
- **Label** (400, 17/22): row labels and buttons (600 on buttons). The minimum for anything
  tappable.
- **Caption** (400, 15/20): Subheadline — a note under a row, a chat's last message.
- **Micro** (400, 13/18): Footnote — timestamps, section headings and footers, status. The floor.

Two sizes fall below the floor because the platform sets them: the tab bar's 10pt labels and a
bubble's 11pt timestamp.

### Named Rules
**The Spread, Don't Size Rule.** Text styles spread a `type` step; a screen does not write its own
font size.

**The Start Edge Rule.** Wrapping text sets `textAlign: "left"` with `writingDirection: "auto"`,
which React Native mirrors to the start edge in Hebrew. A passphrase field stays LTR.

## Layout

Every form-like screen scrolls inside `Screen`: 16pt side gutter (the system's list margin), 8pt
top, 48pt bottom, 24pt between sections. A section's header and footer are Footnote in secondary
text, inset 16pt so they start where the rows' text does. Rows pad 12pt vertically and never fall
under 48pt. Spacing uses only 4, 8, 12, 16, 24, 32 and 48.

A tab's name is a Large Title at the top of its scrolling content. The header above it starts
empty and takes the name, centred at Headline with a hairline under it, once the title has
scrolled away (`useLargeTitle`).

The chat list is not grouped cards: full-bleed rows 76pt tall on the plain background, a 52pt
avatar, a separator inset past the avatar, and a fixed 104pt status column at the trailing edge so
statuses align in one column to scan.

The tutorial is a full-screen horizontal pager on the grouped background: Skip at the top trailing
edge, centred content, page dots and a full-width filled button at thumb height.

Verify stacks: a centred outcome (a 56pt green `checkmark.circle.fill`, what happened, the chat's
name), one group that leads with the counts as numerals and continues with the facts, the media
note, Drive backup, then the button column (12pt gap, primary first).

## Elevation & Depth

Flat, with tonal layering, as iOS grouped lists are: a grey page, white cells; in the dark, a black
page and lifted cells. No component defines a shadow. Headers have no shadow, except the tab
header's hairline once a large title has collapsed into it. The tab bar is divided by a hairline.

## Shapes

All corners are continuous (`borderCurve: "continuous"`). Groups, callouts and tutorial pictures
20pt; fields 12pt; chips and photo tiles 8pt; a sheet's top 28pt; buttons and status capsules fully
rounded. Message bubbles 18pt with the tail corner squared on the last of a run. Avatars, step
discs and the selection circle are circles. The app's mark is always drawn at an app icon's own
proportions (corner = 22.37% of the side).

Icons are SF Symbols, monochrome, tinted by role: filled in the tab bar, outline in a navigation
bar (`plus`, `house`), `chevron.forward` for "leads somewhere" (it mirrors in RTL),
`chevron.down`/`chevron.up` for disclosure, `checkmark` for a chosen row. Android falls back to
drawn shapes.

## Components

### Buttons
Full-width capsules, 50pt minimum, Body at weight 600.
- **Primary:** tint fill, white label.
- **Quiet:** tint wash, tint label.
- **Danger:** red wash, red label.
- **Pressed / Disabled:** 60% opacity pressed; 40% disabled.
- **Help pill:** a hugging tint-wash capsule with a help symbol, 48pt.

### Groups and Rows
`Section` is an inset grouped list: one cell-coloured surface, 20pt corners, separators inserted
between its children from the text's leading edge to the trailing edge. Label/value rows lead with
the label in primary text and trail with the value in secondary. Link rows end in a faint chevron;
choice rows end in a tint checkmark; switch rows toggle from the whole row; check rows lead with a
24pt selection circle that fills with the tint. Tappable rows highlight grey to the group's edges.

### Status
A chat's status is its row's trailing detail. "On this phone" is plain secondary Footnote; "Safe
to delete" is a green-wash capsule with green 600 type; "Uploading" is tint Footnote above a 4pt
progress bar; "Deleted" is a faint checkmark and word.

### Fields
A cell-coloured well with 12pt corners, 50pt minimum, Body type, LTR, faint placeholder, keyboard
appearance matching the palette, no outline at rest. An error turns the outline red and sits
beneath in Footnote red.

### Steps
A numbered instruction: a 28pt tint disc with a white numeral, then Body text. In the tutorial the
disc is 32pt beside 20pt text. The picture above it is a 390:520 raster with 20pt corners and a
hairline outline — a crop of a screen, never a drawn device bezel.

### Messages
Grey bubbles for other people, with a coloured sender name once per run; the tint with white type
for the reader. Day separators and system messages are plain centred secondary text. Media the
archive does not hold is a dashed-outline chip, in place.

### Navigation
A bottom tab bar on the cell colour with a hairline top; active tint, inactive faint; filled SF
Symbols at 24pt with 10pt labels. Pushed screens use the native stack header: tint back and
actions, Headline title, and a Home button at the trailing edge. Adding a chat is a `plus` in the
chat list's header, opening a sheet that closes with Done.

### Motion
When a tutorial step page settles, its picture lifts 18pt into place while fading in (320ms,
exponential ease-out), then its disc springs from 60% scale. With Reduce Motion both appear static,
the pager scrolls without animation, and the modal fades instead of sliding.

## Constraints

- **No new native modules.** Installed builds take JavaScript over the air (`expo-updates`,
  `runtimeVersion: appVersion`); an update importing a module the binary lacks crashes at launch.
  So there is no `expo-glass-effect`, no `expo-blur` and no `expo-router/unstable-native-tabs` —
  the tab bar is opaque and the large titles are done by hand. A real Liquid Glass tab bar and
  native large titles belong with the next store build.
- **The routes do not move.** Large titles are not obtained by nesting a stack inside each tab; a
  share cold-start depends on the current route layout (`apps/mobile/CLAUDE.md`).
- **The raster assets predate this system.** The mark (`design/brand/mark.svg`) is ultramarine and
  the tutorial pictures (`design/tutorial/screens.html`) ring the control to tap in yellow.

## Do's and Don'ts

### Do:
- **Do** build a screen from `components/app/ui.tsx` and take every value from `lib/ui/theme.ts`.
- **Do** keep one filled button per screen; others take `quiet`.
- **Do** use the system's semantic colours and SF Symbols before inventing anything.
- **Do** keep every tappable thing at 48pt or more, and use the 16pt gutter on every screen.
- **Do** separate surfaces by lightness and let `Section` insert separators.
- **Do** give motion a Reduce Motion state.

### Don't:
- **Don't** bring back the ultramarine fields, the orange button, the yellow plates or Secular One.
- **Don't** add a second accent colour, or tint an ordinary state with `good`, `bad` or `caution`.
- **Don't** use a red warning for a normal situation such as media the export did not include.
- **Don't** add borders or shadows to make a card visible.
- **Don't** set text smaller than `micro` (13pt), or write a font size or padding a screen invents.
- **Don't** replace native navigation or controls with branded imitations.
- **Don't** add a native dependency for a visual effect without planning a store build around it.
