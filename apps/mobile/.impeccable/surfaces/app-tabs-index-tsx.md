---
version: 1
slug: "app-tabs-index-tsx"
primary_target: "app/(tabs)/index.tsx"
related_targets: ["components/app/Onboarding.tsx","app/verify.tsx"]
---

# The iOS app (apps/mobile) — tutorial, chat list, import/verify flow, settings

Scope: every app screen (Operate), with Persuade-grade brand moments in the tutorial, empty chat list and Verify proof.
Audience: Hebrew-speaking, non-technical Israelis incl. parents and grandparents; iOS first, Android ships the same design.
Tasks: follow the tutorial, add a chat via WhatsApp's share sheet, trust Verify, delete in WhatsApp themselves, read old chats.
Constraints: minimal on-screen text (explanations in Help), 48pt targets, iOS navigation/tab bar/sheets, SF for UI text, dark mode first-class, no new unpinned native dependencies (expo-symbols and expo-font are already in the native build).

## Direction contract

THESIS: The app is a public sign you can operate: calm native iOS structure, with ultramarine sign fields and solid pictograms reserved for the moments that tell you what to do or prove what was saved. Refuses the cute wood-brown cupboard look and generic white backup-app chrome.

OWN-WORLD: Ultramarine #2436c9 tint and brand fields; signal orange #ff5b24 for the one primary action with ink text; sun yellow #ffd23f for "safe to delete"; ink/white grounds with cool grey grouped panels; dark theme on blue-black. SF text styles for UI, Secular One for display numerals and tutorial titles. SF Symbols for UI icons; authored solid pictograms for brand moments.

STORY: First launch shows an ultramarine sign sequence: what Boydem does, then the real WhatsApp steps as screenshots with a leader-line callout on the exact button, then safe-to-delete. Chats list reads status in one aligned column. Verify shows huge numerals on a sign field before offering the delete guide.

FIRST VIEWPORT: Tutorial slide 1: full-screen ultramarine, Boydem sign mark large at top third, white Secular One title, one line, orange full-width Next button at thumb height, page marks as square ticks. Slides 2–5: paper ground, a tall ink-rimmed WhatsApp screenshot with a yellow ring and a numbered plate pinned on the exact control, a matching sun plate and one line beneath. Slide 6 returns to ultramarine with a live StatusPill specimen of "safe to delete".

FORM: Israeli modernist identity program / public signage; position 6 of the grounded list; seed key 1e9cb030. Signature interaction: when a tutorial page settles, its screenshot lifts into place and its yellow number plate stamps in a beat later (the callout ring is baked into the screenshot); Reduce Motion shows both static.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
