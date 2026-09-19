# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, both Hebrew-speaking and mostly non-technical:

1. Everyday Israeli WhatsApp users whose phone is full, including parents and grandparents,
   deciding whether to install בוידעם (home page).
2. A group member or relative who received a link to a chat someone shared, reading it in a
   phone or desktop browser with no account (shared-chat viewer at `/s/<folderId>`).

Hebrew and right-to-left first.

## Product Purpose

בוידעם (Boydem — Hebrew for the attic) is an iPhone app that turns a WhatsApp chat export into a
verified archive saved on the phone and in the user's own Google Drive, then walks them through
deleting the chat in WhatsApp themselves to free space.

The website has exactly two jobs (owner, 2026-09-11): a home page that explains the app, shows
prices and sends people to the app; and a viewer for one chat shared by link. A reader of a
shared chat may also copy it into their own Google Drive ("שמירה אצלי"). No Boydem sign-in, no
upload, no chat tools on the website.

## Positioning

Chats never live on Boydem's servers: they stay on the phone and in the user's own Drive, as plain
files by default. Boydem reads back and counts what it saved before saying a chat is safe to delete,
and it never deletes anything from WhatsApp itself.

## Operating Context

- The app's flow: in WhatsApp, chat name → Export Chat → Attach Media → Boydem; the app saves,
  backs up to Drive, shows "safe to delete"; the user deletes the chat in WhatsApp.
- Shared chats are read straight from Google Drive in the visitor's browser. Protected chats carry
  their key in the URL fragment; pages carrying a key load no third-party scripts.
- The App Store link is not live yet; the call to action reads "coming soon" until it is.

## Capabilities and Constraints

- Never imply Boydem deletes from WhatsApp or frees space itself.
- Never call a plain (unprotected) chat encrypted.
- Pricing (may move): up to 5 chats free, 6–20 for ₪10/month, 21+ for ₪20/month; Drive storage on
  every tier.
- Fonts self-hosted via `next/font`; no visitor request to third-party font or analytics hosts.
- `no-referrer` policy site-wide; nothing may serialize a URL fragment.

## Brand Commitments

- The name בוידעם / Boydem stays. The wood-cupboard mark and wood-brown palette were released for
  replacement by the owner on 2026-09-17.

## Evidence on Hand

- One real Hebrew export pair verified end to end (127 messages, 15 attachments, merged to 127).
- No testimonials, user numbers, ratings, press or store listing exist. Do not invent them.

## Product Principles

1. Show the product doing its job instead of describing it.
2. Every path on the home page leads to the app.
3. The shared-chat viewer reads like a chat, not a document.
4. Calm, plain Hebrew; no hype and no fear.

## Accessibility & Inclusion

Older and non-technical visitors: large readable type, generous tap targets, full RTL
correctness, light and dark schemes, works on a phone browser first.
