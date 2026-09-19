---
name: Boydem (בוידעם) — iOS app
description: A public sign you can operate; native iOS structure with ultramarine sign moments, in Hebrew and English.
colors:
  sign: "#2436c9"
  on-sign: "#ffffff"
  on-sign-muted: "#cdd3fa"
  signal: "#ff5b24"
  on-signal: "#111114"
  sun: "#ffd23f"
  on-sun: "#111114"
  accent: "#2436c9"
  accent-soft: "#5363e0"
  accent-wash: "#e6e9fb"
  on-accent: "#ffffff"
  paper: "#f2f3f7"
  panel: "#ffffff"
  raised: "#ffffff"
  sunken: "#e4e6ee"
  field: "#ffffff"
  ink: "#111114"
  body: "#2c2e36"
  muted: "#555864"
  faint: "#6c6f7b"
  hairline: "#d9dce5"
  separator: "#e4e6ee"
  self-bubble: "#dfe4fc"
  good: "#0d7a48"
  good-wash: "#e1f3ea"
  bad: "#c23220"
  bad-wash: "#fbe9e6"
  caution: "#855f00"
  caution-wash: "#fbf0d2"
  scrim: "rgba(10, 12, 30, 0.45)"
  signal-dark: "#ff6a36"
  accent-dark: "#97a3ff"
  accent-soft-dark: "#6f7cf0"
  accent-wash-dark: "#1a2050"
  on-accent-dark: "#0b0d16"
  paper-dark: "#0b0d16"
  panel-dark: "#161a27"
  raised-dark: "#1f2433"
  sunken-dark: "#05060b"
  field-dark: "#161a27"
  ink-dark: "#f3f4f8"
  body-dark: "#d5d8e1"
  muted-dark: "#a2a6b4"
  faint-dark: "#868a99"
  hairline-dark: "#2a2f40"
  separator-dark: "#212636"
  self-bubble-dark: "#252c5c"
  good-dark: "#4fd08f"
  good-wash-dark: "#0e281c"
  bad-dark: "#ff8b75"
  bad-wash-dark: "#2d1512"
  caution-dark: "#efc24f"
  caution-wash-dark: "#2a220c"
  scrim-dark: "rgba(0, 0, 0, 0.6)"
typography:
  numeral:
    fontFamily: "SecularOne"
    fontSize: "60px"
    fontWeight: 400
    lineHeight: "64px"
  display:
    fontFamily: "SecularOne"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: "38px"
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
    lineHeight: "24px"
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
    fontWeight: 500
    lineHeight: "18px"
rounded:
  plate: "4px"
  chip: "8px"
  field: "12px"
  button: "14px"
  card: "14px"
  sheet: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
  gutter: "24px"
  tap: "48px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 16px"
    height: "52px"
  button-quiet:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 16px"
    height: "52px"
  button-danger:
    backgroundColor: "{colors.bad-wash}"
    textColor: "{colors.bad}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 16px"
    height: "52px"
  section-group:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0 16px"
  row:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "12px 0"
    height: "52px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
    height: "52px"
  status-plate:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.muted}"
    typography: "{typography.micro}"
    rounded: "{rounded.plate}"
    padding: "3px 8px"
  status-plate-safe:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.on-sun}"
    typography: "{typography.micro}"
    rounded: "{rounded.plate}"
    padding: "3px 8px"
  step-plate:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.on-sun}"
    rounded: "{rounded.plate}"
    size: "32px"
  sign-card:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.on-sign}"
    rounded: "{rounded.card}"
    padding: "24px"
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
    padding: "12px 24px"
    height: "76px"
  tab-bar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
  step-shot:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.sheet}"
---

# Design System: Boydem (בוידעם) — iOS app

## Overview

**Creative North Star: "The Public Sign You Operate"**

The app is an iPhone app first and a sign second. Structure, navigation and controls are native iOS: tab bar, stack headers, grouped lists, sheets, switches, San Francisco for every word a user reads or taps, and SF Symbols for UI icons. The sign language lives in the layer iOS leaves open: the tint, a few full-colour moments, and display type.

Those moments are where the app tells you what to do or proves what it saved. The tutorial opens and closes on a full-screen ultramarine field; Verify states its counts as huge white numerals on an ultramarine card; the Account screen's sign-in moment is an ultramarine card with the mark. Everywhere else the screen is calm: a cool grey page, white grouped surfaces, ink text, one orange button.

Colour is information. Orange is the one thing to press, yellow is "safe to delete" and the numbered step plates, and `good`/`bad`/`caution` are reserved for Verify, the delete guide and a chat's status. An ordinary state gets no colour at all. Dark mode is first-class and is not the light palette inverted.

**Key Characteristics:**
- Native iOS structure; SF text on Apple's text-style sizes, following Dynamic Type.
- Ultramarine sign fields reserved for tutorial, Verify's proof and the sign-in moment.
- One Signal Orange button per screen, ink label.
- Sun yellow plates (4px corners): "safe to delete" and step numbers.
- Surfaces separate by lightness (paper, panel, raised, sunken), not borders or shadows.
- Every size, gap and corner comes from `lib/ui/theme.ts`; nothing tappable under 48pt.
- Secular One only for `display` and `numeral`.

## Colors

One ultramarine program, two signal colours with single jobs, cool blue-grey neutrals, and three reserved information hues.

### Primary
- **Ultramarine Sign** (#2436c9): whole fields (tutorial pages 1 and 6, Verify's proof card, the Account hero) and, in light mode, the iOS tint (`accent`): links, switches, the selected tab, the add button, section actions, the active tutorial tick, the uploading label. The field keeps its full depth in dark mode.
- **Periwinkle Tint** (#97a3ff, dark): the dark palette's `accent`, lifted because ultramarine text disappears on a dark ground.
- **Soft Ultramarine** (#5363e0 / dark #6f7cf0): a second accented thing beside the first.
- **Tint Wash** (#e6e9fb / dark #1a2050): quiet button ground, pressed-row highlight, help pill, accent chip.

### Secondary
- **Signal Orange** (#ff5b24 / dark #ff6a36): the primary button and the tutorial's Next button. Ink type on it.

### Tertiary
- **Sun Yellow** (#ffd23f): the "safe to delete" status plate, the numbered step plates (tutorial and procedures), and the ring baked into the tutorial pictures. Ink type on it.

### Neutral
- **Cool Paper** (#f2f3f7 / dark #0b0d16): every screen's ground, headers and tab scenes.
- **Panel White** (#ffffff / dark #161a27): grouped sections, the tab bar.
- **Raised** (#ffffff / dark #1f2433): message bubbles; in the dark, elevation adds light.
- **Sunken** (#e4e6ee / dark #05060b): quiet status plate, switch off-track, progress track.
- **Ink** (#111114 / dark #f3f4f8): primary text; the tutorial picture rim in light mode.
- **Body** (#2c2e36 / dark #d5d8e1): body copy and step text.
- **Muted** (#555864 / dark #a2a6b4): labels, section headings, notes, inactive tabs.
- **Faint** (#6c6f7b / dark #868a99): timestamps, units, chevrons, placeholders.
- **Hairline** (#d9dce5 / dark #2a2f40): the outline of a shape: field border, checkbox, tab bar top.
- **Separator** (#e4e6ee / dark #212636): the line between rows inside one group.
- **Own Bubble** (#dfe4fc / dark #252c5c): messages the reader sent.
- **Muted on Sign** (#cdd3fa): secondary type on an ultramarine field.
- **Scrim** (rgba(10, 12, 30, 0.45) / dark rgba(0, 0, 0, 0.6)): behind sheets and the lightbox.

### Information
- **Record Green** (#0d7a48 / dark #4fd08f) on Green Wash (#e1f3ea / #0e281c): saved, checked confirmation.
- **Brick** (#c23220 / dark #ff8b75) on Brick Wash (#fbe9e6 / #2d1512): destructive actions and real failures only.
- **Amber Ink** (#855f00 / dark #efc24f) on Amber Wash (#fbf0d2 / #2a220c): look at this before you act; not a failure.

### Named Rules
**The Flood, Not Sprinkle Rule.** Ultramarine as a surface is a whole field (a full-screen page or a full-width card), never a thin stripe or tinted border on grey.

**The One Orange Rule.** One Signal Orange button per screen, with ink type. Everything else is `quiet` (tint wash with tint label).

**The Only Yellow Rule.** Sun yellow means "safe to delete" or "this step". Nothing else is yellow; Verify's "saved" plate is white on the field for exactly this reason.

**The Information Colours Rule.** `good`, `bad` and `caution` carry meaning on Verify, the delete guide and chat status. Nothing decorative uses them and a normal state gets no colour.

**The Not Inverted Rule.** The dark palette is blue-black, the tint lifts to periwinkle to clear AA, orange lifts slightly, and the sign field and sun keep their light values.

## Typography

**Display Font:** Secular One (`SecularOne`, bundled in `assets/fonts`, loaded at launch)
**Body Font:** San Francisco (the iOS system font)

**Character:** Secular One is a heavy, single-weight geometric Hebrew sign face used only where the screen is the statement. San Francisco does everything read or tapped, at Apple's own text-style sizes, so a Boydem screen sits beside Settings and Mail and grows with Dynamic Type.

### Hierarchy
- **Numeral** (Secular One 400, 60/64): the counts on Verify, white on the sign card.
- **Display** (Secular One 400, 32/38): the chat's name on Verify, an empty library's headline. The tutorial's sign titles set it at 38/44 and the Account hero at 28/34.
- **Title** (SF 700, 22/28, -0.3 tracking): a screen heading, a tab's header title (leading-aligned).
- **Heading** (SF 600, 17/22): a card heading, a chat row's name, a callout title.
- **Body** (SF 400, 17/24): instructions and explanations; empty-state body capped at 320pt.
- **Label** (SF 400, 17/22): row labels and buttons (600 on buttons, 700 on the tutorial Next). The minimum for anything tappable.
- **Caption** (SF 400, 15/20): a note under a row, a chat's last message, row labels in value pairs.
- **Micro** (SF 500, 13/18): timestamps, units, section headings, status plates. The floor.

### Named Rules
**The Single Cut Rule.** Any style using Secular One sets `fontWeight: "400"`; asking iOS for a bolder cut of a one-weight custom face drops it to the system font.

**The Spread, Don't Size Rule.** Text styles spread a `type` step; a screen does not write its own font size. The reader's message body is the one sanctioned exception.

**The Start Edge Rule.** Wrapping text sets `textAlign: "left"` with `writingDirection: "auto"`, which React Native mirrors to the start edge in Hebrew. A passphrase field stays LTR.

## Layout

Every screen scrolls inside `Screen`: 24pt side gutter, 16pt top, 48pt bottom, 24pt between sections. A section's header sits 8pt above its surface with 4pt inset. Rows inside a group pad 12pt vertically and never fall under 48pt (tappable rows 52pt). Spacing uses only 4, 8, 12, 16, 24, 32 and 48.

The chat list is deliberately not grouped cards: full-bleed rows 76pt tall with the 24pt gutter, a 52pt avatar, a hairline separator inset past the avatar, and a fixed 104pt status column at the trailing edge so statuses align in one column to scan.

The tutorial is a full-screen horizontal pager: fixed 60pt top and 40pt bottom insets, Skip at the top trailing edge, a footer with page ticks and a full-width 54pt Next button at thumb height. Step pictures size to the height left over at 390:520, capped by the gutters.

Verify stacks: the ultramarine proof card (24pt padding and gap; counts in a wrapping row 32pt apart), a group of facts, the media note, Drive backup, then the button column (12pt gap, primary first).

## Elevation & Depth

Flat, with tonal layering. Surfaces separate by lightness as iOS grouped lists do: Cool Paper page, white panels, raised bubbles, sunken wells. In the dark palette, panels and raised surfaces are lighter than paper, so elevation adds light rather than shadow. Headers set `headerShadowVisible: false`; the tab bar is divided by a 1pt hairline. No component in the system defines a shadow; a sheet or lightbox separates with the scrim.

### Named Rules
**The Lightness Not Lines Rule.** A card is visible because it is lighter than the page, not because it has a border. `hairline` outlines a shape; `separator` divides rows inside one; they are not interchangeable.

## Shapes

Two corner families. iOS continuous rounding for things you tap and group: field 12, button 14, card 14, sheet 22, pill 999. A near-square plate for signs: 4pt on status plates, step number plates, Verify's saved plate and pills, because a sign's corners are cut, not moulded. The tutorial's page ticks are 4pt bars with 1pt corners (18 wide, 30 when active).

Tutorial and add-chat pictures take the sheet radius (22) with a 3pt rim in ink (raised in dark mode): a crop of a screen, never a drawn device bezel. Avatars are circles. The mark renders at card radius at large sizes (112, 132) and chip radius (8) at 64.

Icons are SF Symbols (filled variants for tabs and actions, `chevron.forward` that mirrors in RTL, `checkmark`), monochrome, tinted by role. Android falls back to drawn solid shapes. Brand art (the mark, rendered from `design/brand/mark.svg`) is solid geometric fills: gable, orange speech bubble, white and periwinkle floors on ultramarine.

## Components

### Buttons
Tactile, full-width, one loud and the rest tinted.
- **Shape:** continuous rounding (14pt), 52pt minimum height, 12 × 16 padding.
- **Primary:** Signal Orange, ink label at label size weight 600.
- **Quiet:** Tint Wash ground, tint label; the iOS tinted button.
- **Danger:** Brick Wash ground, brick label.
- **Pressed / Disabled:** 60% opacity pressed; 40% opacity disabled.
- **Tutorial Next:** Signal Orange, 54pt, label weight 700, 70% opacity pressed.
- **Help pill:** fully rounded Tint Wash with a help symbol and 600 tint label, 48pt.

### Status Plates
The chat's status in one trailing column. "On this phone" is a Sunken plate with Muted micro text; "Safe to delete" is Sun Yellow with ink micro text at 700; "Uploading" is tint micro text above a 4pt progress bar; "Deleted" drops the plate for a faint checkmark and word. Padding 3 × 8, 4pt corners.

### Cards / Containers
- **Corner Style:** 14pt.
- **Background:** Panel White on Cool Paper; callouts on Green, Brick or Amber Wash, or panel for a neutral note.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none; separators are inserted between a group's rows by `Section`, never drawn by a row.
- **Internal Padding:** 16pt horizontal for groups; 16pt all round for callouts.

### Sign Card
Verify's proof and the Account hero: an ultramarine card, 14pt corners, 24pt padding and gap. On Verify it holds a white plate (tint type, check symbol) naming the outcome, the chat name in display white, and the counts as numerals with muted-on-sign labels.

### Inputs / Fields
- **Style:** Field ground, 1pt Hairline border, 12pt corners, 52pt minimum, 12 × 16 padding, body type, LTR, faint placeholder, keyboard appearance matching the palette.
- **Error:** border turns Brick; the message sits beneath in caption Brick.

### Rows and Choices
Label/value rows put a caption Muted label at the start and the value at the end (heading weight when strong). Link rows end in a faint chevron; choice rows end in a tint checkmark and set the selected label at 600; switch rows toggle from the whole row, track in tint (off: sunken); check rows use a 26pt checkbox with 2pt Hairline border that fills Record Green when checked. Pressed rows take the Tint Wash.

### Navigation
Native tabs: Panel tab bar with a 1pt Hairline top and 8pt top padding; active tint, inactive Muted; filled SF Symbols at 24pt. Tab headers on Cool Paper, no shadow, leading-aligned title step. Stack headers use the tint for back and actions, and every screen below the tabs carries a Home button. Adding a chat is a header button (a 28pt filled plus in tint) opening a sheet, not a tab.

### Step Plate and Step Picture
A numbered instruction: a 32pt Sun Yellow plate (4pt corners) with a Secular One numeral in ink, then body text. In the tutorial the plate is 36pt with a 22pt numeral beside step text at 19/26. The picture above it is a 390:520 raster rendered from `design/tutorial/screens.html`, framed with the sheet radius and a 3pt ink rim.

### Signature Motion: Lift and Stamp
When a tutorial step page settles, its picture lifts 18pt into place while fading from 35% (320ms, exponential ease-out), then its plate stamps from 60% scale on a spring (friction 5, tension 160). With Reduce Motion both appear static, the pager scrolls without animation, and the modal fades instead of sliding.

## Do's and Don'ts

### Do:
- **Do** build a screen from `components/app/ui.tsx` and take every value from `lib/ui/theme.ts`.
- **Do** keep one Signal Orange (#ff5b24) button per screen with ink (#111114) type; others take `quiet`.
- **Do** keep ultramarine (#2436c9) surfaces as whole fields for the tutorial, Verify's proof and the sign-in moment.
- **Do** reserve Sun Yellow (#ffd23f) for "safe to delete" and step number plates.
- **Do** set counts that are evidence in `numeral`, white on the sign field.
- **Do** keep SF for all UI text and SF Symbols for UI icons; Secular One only for `display` and `numeral`, weight 400.
- **Do** keep every tappable thing at 48pt or more, and use the 24pt gutter on every screen.
- **Do** separate surfaces by lightness and let `Section` insert separators.
- **Do** give motion a Reduce Motion state.

### Don't:
- **Don't** put white type on Signal Orange.
- **Don't** make anything else yellow, or tint an ordinary state with `good`, `bad` or `caution`.
- **Don't** use a red warning for a normal situation such as media the export did not include.
- **Don't** add borders or shadows to make a card visible, or a coloured stripe down a callout's side.
- **Don't** invert the light palette for dark mode; use the dark tokens.
- **Don't** set text smaller than `micro` (13pt), or write a font size or padding a screen invents.
- **Don't** draw a device bezel around a tutorial picture; it is a crop with a rim.
- **Don't** replace native navigation, tab bar or controls with branded imitations.
