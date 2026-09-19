---
name: Boydem (בוידעם) — web
description: The home page and shared-chat viewer, set as a public sign system in Hebrew, right to left.
colors:
  sign: "#2436c9"
  sign-deep: "#1a2799"
  sign-soft: "#8e98e8"
  on-sign: "#ffffff"
  on-sign-muted: "#cdd3fa"
  signal: "#ff5b24"
  on-signal: "#111114"
  sun: "#ffd23f"
  on-sun: "#111114"
  bg: "#ffffff"
  panel: "#f2f3f7"
  fg: "#111114"
  body: "#2c2e36"
  muted: "#555864"
  line: "#d9dce5"
  rule: "#111114"
  accent: "#2436c9"
  good: "#0d7a48"
  chat-bg: "#eceef5"
  bubble: "#ffffff"
  bubble-self: "#dfe4fc"
  footer-ground: "#111114"
  bg-dark: "#111114"
  panel-dark: "#1c1d24"
  fg-dark: "#f3f4f8"
  body-dark: "#d5d8e1"
  muted-dark: "#a2a6b4"
  line-dark: "#2c2e37"
  rule-dark: "#f3f4f8"
  accent-dark: "#97a3ff"
  good-dark: "#4fd08f"
  chat-bg-dark: "#07080f"
  bubble-dark: "#1a1e2c"
  bubble-self-dark: "#252c5c"
typography:
  display:
    fontFamily: "Secular One, Arial Hebrew, system-ui, sans-serif"
    fontSize: "clamp(3rem, 7.2vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.98
  headline:
    fontFamily: "Secular One, Arial Hebrew, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 5vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 1.05
  numeral:
    fontFamily: "Secular One, Arial Hebrew, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 3.4rem)"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "Secular One, Arial Hebrew, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 400
    lineHeight: 1.15
  plate:
    fontFamily: "Secular One, Arial Hebrew, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 400
    lineHeight: 1
  lead:
    fontFamily: "Assistant, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "Assistant, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Assistant, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 800
    lineHeight: 1.4
  caption:
    fontFamily: "Assistant, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  plate: "4px"
  board-sign: "6px"
  button-compact: "12px"
  button: "14px"
  bubble: "1rem"
  dialog: "1.2rem"
  shot: "22px"
  pill: "999px"
spacing:
  gutter: "1.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
  xxl: "3rem"
  section: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0.8rem 1.6rem"
    height: "3.5rem"
  button-primary-compact:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.button-compact}"
    padding: "0.4rem 1rem"
    height: "2.5rem"
  sign-field:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.on-sign}"
  plate:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "0 0.5rem"
    height: "2rem"
  plate-sun:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.on-sun}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "0 0.5rem"
    height: "2rem"
  count-plate:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.on-sun}"
    rounded: "{rounded.plate}"
    padding: "0.6rem 1.1rem 0.5rem"
    width: "8.5rem"
  board-sign:
    backgroundColor: "{colors.on-sign}"
    textColor: "{colors.sign}"
    rounded: "{rounded.board-sign}"
    size: "4.5rem"
  tutorial-shot:
    backgroundColor: "#f2f2f7"
    rounded: "{rounded.shot}"
  bubble-other:
    backgroundColor: "{colors.bubble}"
    textColor: "{colors.fg}"
    rounded: "{rounded.bubble}"
    padding: "0.4rem 0.65rem 0.3rem"
  bubble-self:
    backgroundColor: "{colors.bubble-self}"
    textColor: "{colors.fg}"
    rounded: "{rounded.bubble}"
    padding: "0.4rem 0.65rem 0.3rem"
  day-chip:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.muted}"
    rounded: "{rounded.plate}"
    padding: "0.2rem 0.7rem"
  jump-down:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.on-sign}"
    rounded: "{rounded.pill}"
    size: "2.75rem"
  jump-down-hover:
    backgroundColor: "{colors.sign-deep}"
  dialog:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.dialog}"
    padding: "1.5rem"
  app-banner:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.on-sign}"
    padding: "0.75rem 1rem"
---

# Design System: Boydem (בוידעם) — web

## Overview

**Creative North Star: "The Public Sign"**

Boydem's website reads like a well-made Israeli public sign program: flat fields of one strong colour that run edge to edge, one solid pictogram per idea, and numbers set large enough to read from across a room. The page is Hebrew and right to left first (`lang="he" dir="rtl"`); every layout rule is written in logical terms so it holds in both directions.

Density is low and deliberate. The home page alternates full-bleed ultramarine sign fields (hero, the directory board, the closing) with white reading sections ruled by heavy ink lines, the way a lobby directory or a fare table is ruled. Colour carries meaning, not decoration: ultramarine is the brand ground, orange is the one thing to press, yellow is the thing to read. There are no colour gradients, no glass, no blur.

The shared-chat viewer inherits the world quietly. There, the conversation is the content: ultramarine becomes the tint and the jump-down control, orange stays the one action (keep this chat), and the display face appears only on the chat's name and dialog titles.

**Key Characteristics:**
- Full-bleed ultramarine fields with white Secular One type.
- Signal orange for the single action, always with ink type.
- Sun yellow plates (4px corners) for step numbers, counts and "safe to delete".
- 3px ink rules for tables, section starts and the FAQ; 1px lines between rows.
- Secular One at one weight for voice; Assistant for everything read.
- Solid pictograms on a white sign square; the mark is a gable, a chat bubble and two floors.
- Light and dark by `prefers-color-scheme`; sign fields keep their full depth in both.

## Colors

One saturated brand hue flooding whole fields, two signal colours with strict jobs, and cool ink neutrals.

### Primary
- **Ultramarine Sign** (#2436c9): the brand field. Hero, directory board, closing section, app banner in the viewer, the FAQ plus plate, the jump-down button, the progress fill, `theme-color`, and the mark's ground. Also the interactive tint (`accent`) in light mode.
- **Deep Ultramarine** (#1a2799): hover state of ultramarine controls only.
- **Periwinkle Floor** (#8e98e8): the mark's lower floor and the scene's soft floor. Lives in the brand art only, not in UI.

### Secondary
- **Signal Orange** (#ff5b24): fills the one action: get the app, keep this chat, the dialog's confirm. Also the travelling bubble in the brand mark and hero scene. Type on it is always ink (#111114).

### Tertiary
- **Sun Yellow** (#ffd23f): plates to read (step numbers under the tutorial pictures, the example counts, the "safe to delete" plate, the "you" tag in chat info), text selection, and the focus ring. Type on it is ink.

### Neutral
- **White Ground** (#ffffff) / **Night Ground** (#111114): page background by scheme. The footer is always Night Ground.
- **Cool Panel** (#f2f3f7 / dark #1c1d24): hover wash on viewer rows, the selected person row.
- **Ink** (#111114 / dark #f3f4f8): headings, strong text, and the `rule` colour for heavy lines.
- **Body Slate** (#2c2e36 / dark #d5d8e1): answer paragraphs in the FAQ.
- **Muted Slate** (#555864 / dark #a2a6b4): default paragraph colour, scope and fine print, timestamps.
- **Line Grey** (#d9dce5 / dark #2c2e37): 1px row dividers, viewer header border, dashed absent-media box.
- **Chat Wall** (#eceef5 / dark #07080f), **Bubble** (#ffffff / dark #1a1e2c), **Own Bubble** (#dfe4fc / dark #252c5c): the viewer's conversation surfaces.
- **Periwinkle Accent** (#97a3ff): the dark-scheme tint for links and quiet buttons, because ultramarine text vanishes on a dark ground.
- **Record Green** (#0d7a48 / dark #4fd08f): reserved information colour.
- **Muted on Sign** (#cdd3fa): secondary type on an ultramarine field, tinted from the field rather than grey.

### Named Rules
**The Flood Rule.** Ultramarine is a whole field that runs edge to edge, never a thin accent sprinkled over white. If a section needs the brand, it becomes a sign field.

**The Ink on Orange Rule.** Orange carries ink type, never white; white on this orange fails contrast, and a road sign does it this way anyway. One orange action per view.

**The Sun Is for Reading Rule.** Yellow marks a plate the eye should read or the element that has focus. It never fills a button or a section.

**The No Red for Normal Rule.** A turned-off link, missing media or an unavailable chat is stated in ink or muted type. No red appears for an ordinary situation.

## Typography

**Display Font:** Secular One (with Arial Hebrew, system-ui), self-hosted via `next/font` as `--font-sign`
**Body Font:** Assistant 400/600/700/800 (with system-ui, -apple-system, Segoe UI), self-hosted as `--font-read`
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo for `code` only

**Character:** Secular One is a heavy geometric Hebrew sign face with one cut, so it is always set at 400 and never faux-bolded. Assistant is plain and open, as clear in Hebrew as in Latin, and does all the reading and all the controls.

### Hierarchy
- **Display** (Secular One 400, clamp(3rem, 7.2vw, 6rem), 0.98): the hero headline only, balanced. A second clause sits under it at 0.62em, line-height 1.08.
- **Headline** (Secular One 400, clamp(2.1rem, 5vw, 3.6rem), 1.05): section headings on the home page, balanced, 2.5rem below.
- **Numeral** (Secular One 400, clamp(2.4rem, 5vw, 3.4rem), 1, tabular): prices. The example counts use 2.6rem.
- **Title** (Secular One 400, 1.6rem, 1.15): board row headings (1.35rem under 34rem); fare names at 1.8rem; chat name in info at 1.5rem; dialog titles at 1.5rem.
- **Plate** (Secular One 400, 1.1rem, 1): numbers and short words on plates.
- **Lead** (Assistant 400, 1.25rem, 1.65): the hero paragraph, max 34rem.
- **Body** (Assistant 400, 17px, 1.6): all reading; FAQ answers at 1.08rem/1.7, max 40rem; bubbles at 1rem/1.45.
- **Label** (Assistant 800, 1.05rem): buttons, FAQ questions (1.15rem), captions under tutorial pictures (700).
- **Caption** (Assistant, 0.78–0.95rem): viewer subtitles, day chips (0.78rem 700), timestamps (0.7rem, tabular), footer (0.95rem).

### Named Rules
**The One Cut Rule.** Secular One is only ever weight 400. Emphasis comes from size and field, not weight.

**The Counted Numbers Rule.** Any number that is evidence (prices, counts, timestamps) sets with tabular figures.

## Layout

The page is a stack of full-width bands; content sits in a container of `min(72rem, 100% - 2.5rem)` centred with logical margins, narrowing to `min(46rem, …)` for the FAQ. Sections breathe at 6rem top and 5rem bottom (4rem / 3.5rem under 52rem); the hero and closing use 5.5rem. Inner rhythm reuses 0.75rem, 1rem, 1.25rem, 1.5rem, 2.5rem and 3rem.

- **Hero:** two columns, `1.1fr / 0.9fr`, 3rem gap; copy at the start edge (right in RTL), scene at the end. One column under 52rem.
- **Tutorial pictures:** four equal columns, 1.5rem gap; two columns under 60rem; under 34rem a horizontal scroll-snap row with each picture at 74% width so the next one peeks in.
- **Directory board:** rows of `4.5rem sign / 16rem heading / text`, 2rem gap, divided by a 3px rule at 35% white; under 60rem the sign spans two rows beside heading and text.
- **Fare table:** three columns (name, scope, amount at the end edge), 3px ink rule above the first and below the last row, 1px line between.
- **Viewer:** full-height column (`100dvh`): header, chat wall, optional banner. Bubbles and day rows cap at 54rem centred; a bubble caps at `min(82%, 34rem)`. Side sheet `min(26rem, 100%)`; dialog `min(24rem, 100% - 2rem)`.

Breakpoints: 60rem, 52rem, 34rem.

## Elevation & Depth

The sign world is flat. Fields, plates, rules and pictograms carry no shadow; depth between sections is a change of ground (ultramarine to white to night). Shadows exist only where something genuinely floats or is the one action: the orange call to action, and the viewer's overlays (jump-down, sheet, dialog, bubbles at a hairline). They are soft, ink-blue, and diffuse.

### Shadow Vocabulary
- **Action lift** (`box-shadow: 0 0.5rem 1.2rem -0.5rem rgba(10, 12, 40, 0.45)`): the full-size get-the-app button at rest; deepens to `0 0.8rem 1.6rem -0.6rem rgba(10, 12, 40, 0.5)` with a 2px rise on hover.
- **Floating control** (`box-shadow: 0 0.4rem 1rem -0.3rem rgba(10, 12, 40, 0.45)`): jump-down button.
- **Dialog** (`box-shadow: 0 1.5rem 3rem -1rem rgba(10, 12, 40, 0.5)`): the keep-this-chat dialog.
- **Sheet** (`box-shadow: 0 0 3rem rgba(10, 12, 40, 0.3)`): chat info side sheet.
- **Bubble hairline** (`box-shadow: 0 1px 1px rgba(10, 12, 40, 0.07)`): message bubbles.
- **Mark halo** (`box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35)`): the app icon when it stands on a sign field.

### Named Rules
**The Flat Sign Rule.** A sign surface never casts a shadow. Only the orange action and layers that float over the conversation may.

## Shapes

Two corner families. Signs have cut corners: plates, the day chip and system notes at 4px, the white pictogram square at 6px. Things you tap or hold are softly rounded: the orange buttons at 14px (12px compact), bubbles at 1rem with the run's last bubble squared to 0.25rem on the speaker's side (logical corner, so a Hebrew chat keeps the tail on the right side), the dialog at 1.2rem. Screen pictures take 22px with a 3px ink rim, echoing a phone screen without drawing a bezel. Avatars and the jump-down control are circles.

Heavy rules are 3px (ink on white, 35% white on ultramarine); row dividers are 1px Line Grey. The focus ring is a 3px sun outline offset 3px, backed by a 6px ultramarine halo, so it reads on both white and ultramarine grounds.

Pictograms are solid fills on a 48-unit grid (phone, folder, speech bubble), set in ultramarine inside a white square. The brand mark is the same language: a gable roof, an orange speech bubble in the attic, a white floor and a periwinkle floor, on an ultramarine square.

## Components

### Buttons
Confident, sign-orange, one per view.
- **Shape:** softly rounded (14px); compact (12px).
- **Primary:** Signal Orange with ink label, Assistant 800 at 1.05rem, 0.8rem × 1.6rem padding, 3.5rem minimum height, action-lift shadow.
- **Hover / Focus:** rises 2px with a deeper shadow over 160ms `cubic-bezier(0.16, 1, 0.3, 1)`; returns on press. Viewer buttons brighten 5% instead. Focus is the global sun ring.
- **Compact:** 2.75rem tall, 0.5rem × 1rem, 0.92rem, no shadow (the viewer's keep-this-chat button: 2.5rem, 12px).
- **Coming soon:** the same orange plate as a label, not a link: no pointer, no shadow, no lift.
- **Quiet:** text in the tint colour, weight 700, 2.75rem minimum height, no fill (sheet close, dialog dismiss).

### Plates
The system's signature label. A 2rem-high inline block with 4px corners in Secular One: ink on white-ground plates, sun yellow with ink type for step numbers, counts and "safe to delete". The example count plate stacks a 2.6rem tabular numeral over its word, minimum 8.5rem wide.

### Directory Board
An ultramarine band of ruled rows, each with a 4.5rem white sign square holding a 2.75rem solid ultramarine pictogram, a Secular One heading, and muted-on-sign text at 1.15rem.

### Fare Table
Rows ruled like a timetable: Secular One name (1.8rem), Assistant 600 scope in muted, and a tabular Secular One amount at the end edge with its period in small Assistant.

### FAQ
Native `details` rows. The marker is a 2rem ultramarine plate with a white plus drawn from two 3px bars; open, it turns ink with a single bar (minus). Question in Assistant 800 1.15rem, 4rem minimum height; hover takes the tint.

### Chat Viewer
- **Header:** ground-coloured bar, 1px line below; tappable identity (2.5rem circle avatar, name 800, muted subtitle) with a panel wash on hover.
- **Bubbles:** white or own-bubble fill, 1rem corners, grouped runs 2px apart, 0.5rem after a run; sender name 800 at 0.84rem in the participant's colour (lifted in dark mode by filter).
- **Day chip / system note:** ground-coloured 4px plate, muted, centred.
- **Absent media:** a 1px dashed Line Grey box with muted text, stated plainly.
- **Jump down:** 2.75rem ultramarine circle, white 2.4-stroke chevron, deep ultramarine on hover, at the end-bottom corner.
- **App banner:** an ultramarine strip, muted-on-sign secondary line, dismissible.
- **Progress:** 0.4rem Line Grey track, ultramarine fill, fully rounded.

### Tutorial Pictures
Rasters rendered from `design/tutorial/screens.html`: drawn recreations of WhatsApp's export steps at 390 × 520, with a sun ring and numbered plate on the control to tap. Framed at 22px with a 3px ink rim on an iOS grouped-grey ground (#f2f2f7). The colours inside the pictures belong to the recreated WhatsApp screens, not to this system.

### Signature Motion: The Move
The hero scene plays once on load: three bubbles travel from the phone into the attic over 1.1s (`cubic-bezier(0.7, 0, 0.2, 1)`, 0.3s staggers), shrink and fade; the arrived bubble and the sun "safe to delete" plate land at 2.1s and 2.5s (`cubic-bezier(0.16, 1, 0.3, 1)`); the count plates count up from zero via registered integer properties. With reduced motion the scene is its finished state.

## Do's and Don'ts

### Do:
- **Do** make the brand a field: an ultramarine (#2436c9) band edge to edge with white Secular One type and muted-on-sign (#cdd3fa) secondary text.
- **Do** put ink (#111114) type on Signal Orange (#ff5b24) and Sun Yellow (#ffd23f), always.
- **Do** set step numbers, counts and statuses as plates with 4px corners in Secular One.
- **Do** rule tables and section starts with a 3px ink line and divide rows with a 1px Line Grey (#d9dce5).
- **Do** use Secular One at weight 400 only, and tabular figures for any number that is evidence.
- **Do** draw pictograms as solid fills; a stroke is used only as a heavy silhouette (the hero phone's 12-unit outline) where a fill would hide what it holds.
- **Do** write corners, padding and positions in logical properties so RTL and LTR both hold.
- **Do** give every motion a reduced-motion state that shows the finished picture.

### Don't:
- **Don't** put white type on Signal Orange, or use orange for anything other than the one action and the brand art's bubble.
- **Don't** use yellow as a button fill or a section ground.
- **Don't** use colour gradients, glass, backdrop blur or neon glows; `linear-gradient` appears only as a technique for drawing solid bars and rules.
- **Don't** give a sign field, plate or pictogram a shadow.
- **Don't** fake a bold of Secular One.
- **Don't** colour an ordinary state red; an unavailable link or absent media is ink or muted text.
- **Don't** load fonts or scripts from a third party; faces are self-hosted.
