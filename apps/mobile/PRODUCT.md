# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

(iOS first; the Android build ships the same design rather than adapting to Material.)

## Users

Everyday Hebrew-speaking WhatsApp users in Israel whose phone is full, often not technical,
including parents and grandparents. They arrive with one job: get a chat's messages, photos and
videos out of WhatsApp and somewhere safe, so they can delete the chat and get their space back
without losing a memory. Hebrew and right-to-left first; English exists as a second language.

Secondary: a group member who received a shared-chat link and wants to keep their own copy.

## Product Purpose

בוידעם (Boydem — Hebrew for the attic, the place you put things you keep but don't use daily)
turns a WhatsApp chat export into a verified archive the user owns: saved on the phone and in the
user's own Google Drive, readable like the chat it came from. It then proves what it captured and
walks the user through deleting the chat in WhatsApp themselves.

Success: a user trusts the "safe to delete" moment enough to delete the original chat, and can
open that chat years later.

## Positioning

Boydem never holds the chats: they live on the phone and in the user's own Drive, as plain files
by default. It counts and reads back what it saved before telling the user a chat is safe to
delete, and it merges several group members' exports of the same chat into one archive that
reaches further back than any single export.

## Operating Context

- Entry is always WhatsApp's own Share Sheet: chat → chat name → Export Chat → Attach Media → pick
  Boydem. The app never automates WhatsApp.
- Flow: Share → Import → Verify → Guided delete → chat list → chat reader, info and gallery.
- Each chat shows one status: On this phone → Uploading (progress) → Safe to delete → Deleted · in
  Drive.
- Tabs: Chats, Account (Google sign-in / Drive), Settings (with Help).
- First launch shows a short tutorial, reachable again from the empty chat list.

## Capabilities and Constraints

- Boydem never deletes anything from WhatsApp and never claims to free space itself. The user
  deletes; copy must never imply otherwise.
- Chats never touch Boydem's servers. Encryption is opt-in ("protect with a passphrase"); a plain
  chat must never be called encrypted.
- Minimal text on screens: actions and the facts needed to act. Explanations live in Settings →
  Help. Normal situations (e.g. media missing from an export) get one neutral line, never a red
  warning.
- Pricing (may move): up to 5 chats free, 6–20 for ₪10/month, 21+ for ₪20/month.
- Hebrew copy follows the rules in `apps/mobile/CLAUDE.md`: plural narration, masculine
  וואטסאפ/בוידעם, maqaf before Latin words, real ellipsis.
- No icon or UI library beyond what is installed; unpinned native dependencies have broken the
  app at launch before.

## Brand Commitments

- The name בוידעם / Boydem stays. The visual identity (the wood-cupboard icon, wood-brown palette)
  was released for replacement by the owner on 2026-09-17.

## Evidence on Hand

- Verified on a real Hebrew iOS export pair: 127 messages, 15 attachments, merged to 127 with zero
  unmatched. This is real, but it is one chat, not a user statistic.
- No testimonials, user counts, press, or App Store listing exist yet. Do not invent them.
- Tutorial screens of WhatsApp's export steps are drawn recreations, not real screenshots.

## Product Principles

1. Trust is earned by showing, not asserting: numbers read back from the saved archive.
2. The user stays in control and does the deleting.
3. One action per screen; explanation lives in Help.
4. The chat is the user's, in their Drive, openable without Boydem.
5. A calm tone for normal situations; colour and alarm are reserved for what actually needs it.

## Accessibility & Inclusion

Older and non-technical users: large tap targets (48pt minimum), readable type sizes, no meaning
carried by colour alone, full RTL correctness, dark mode.
