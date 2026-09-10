# MAC-SETUP.md — building the iOS dev client for the Step 0 check

**Temporary.** This file exists only to get the first iPhone build running. Delete it once
Step 0 has passed on a device (see the last section).

The goal: produce a custom Expo **dev client** with the WhatsApp Share Extension, install it on
a physical iPhone, share a real chat export into it, and confirm the handoff works. Nothing
here builds a shippable app — it proves the entry point.

Why a Mac at all: `expo run:ios` shells out to Xcode, which is macOS-only. Windows cannot do
this step; EAS cloud builds can, but need a paid Apple Developer account (Route B below).

---

## 0. Prerequisites

- **macOS** with **Xcode** installed from the App Store, opened once to finish setup.
- Command Line Tools: `xcode-select --install`
- **CocoaPods**: `brew install cocoapods` (or `sudo gem install cocoapods`)
- **Node ≥ 20** and **pnpm 10.14.0**:
  ```bash
  corepack enable && corepack prepare pnpm@10.14.0 --activate
  ```
- A **physical iPhone** with **WhatsApp** installed, plus a USB cable. The iOS Simulator does
  not reliably surface share-sheet extensions and has no WhatsApp — it cannot prove this step.
- A real WhatsApp chat you can **Export chat → With media**. Use a big one (tens of MB or
  more). A 5 KB text-only export passes even when a 200 MB one would crash, so it proves
  nothing.

---

## 1. Get the code

```bash
git clone https://github.com/yehonatancohen/chatvault.git
cd chatvault
# or, if already cloned:
git pull
pnpm install            # run from the repo root
```

---

## 2. Route A — Xcode local build (no paid account)

Free "personal team" signing. Provisioning expires after 7 days and Share Extensions on a
personal team can be finicky — fine for a first proof, not for ongoing work. If it fights you,
use Route B.

```bash
cd apps/mobile
pnpm prebuild                 # generates ios/ (and android/) with the Share Extension target
pnpm ios --device            # pick your plugged-in iPhone when prompted
```

If the CLI build fails on signing, open the workspace and sign by hand:

```bash
open ios/chatvault.xcworkspace
```

In Xcode, for **both** targets — the app **and** `ChatVault Import` — go to
**Signing & Capabilities**, tick **Automatically manage signing**, and pick your personal team.
Confirm both targets share the App Group `group.app.chatvault.mobile`. Then Run (▶) with the
iPhone selected. On the phone: **Settings → General → VPN & Device Management → trust** the
developer profile.

---

## 3. Route B — EAS cloud build (needs Apple Developer Program, $99/yr)

```bash
npm i -g eas-cli
cd apps/mobile
eas login
eas build:configure          # first time only; writes extra.eas.projectId into app.json
pnpm build:dev:ios           # ~10–20 min on Expo's macOS builders; EAS walks you through signing
```

EAS prints an install URL / QR. Open it on the iPhone, install, then trust the profile as
above.

---

## 4. Connect the dev client to Metro

```bash
cd apps/mobile
pnpm start                   # expo start --dev-client
```

Open the ChatVault dev client on the iPhone and scan the QR (same Wi-Fi, or USB).

---

## 5. The Step 0 check

1. On the iPhone: **WhatsApp → a real chat → chat name → Export Chat → With Media**.
2. In the share sheet, choose **ChatVault**.
3. The extension should hand off **immediately**. If it spins or the share sheet dies on a
   large export, the extension is doing work it must not do (it has ~120 MB) — that is the
   finding, stop here and report it.
4. On the **Import** screen, confirm:
   - the file arrived and its size on disk reads correctly;
   - a `.zip` (with-media) export is **measured, not read** — it should show size and a note,
     no parse numbers;
   - a text export shows message count, media count, participants, date range, dialect. Check
     these against the chat in WhatsApp.

**Gate:** a with-media export lands in the App Group container and the host app reports its
size without the extension being killed. Pass → Track A can start. Fail → fix the handoff
first.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `Command "prebuild" not found` | You are in the repo root. `cd apps/mobile` first, or `pnpm --filter @chatvault/mobile prebuild`. |
| `pod install` / CocoaPods errors during prebuild | `brew install cocoapods`, then re-run `pnpm prebuild`. |
| Xcode: "Failed to register bundle identifier" | The bundle id `app.chatvault.mobile` (or `.ChatVault-Import`) is taken on another Apple ID. Change `ios.bundleIdentifier` in `apps/mobile/app.json`, re-run `pnpm prebuild`. |
| Extension target not signed | Sign **both** targets in Xcode (see Route A). The extension is a separate target. |
| Dev client can't reach Metro | Same Wi-Fi, or connect over USB; re-run `pnpm start`. |
| `File` / `Directory` import errors at runtime | Expected only if run in Expo Go — this build must be the custom dev client, not Expo Go. |

---

## 7. When Step 0 passes — delete this file

```bash
git rm MAC-SETUP.md
git commit -m "Remove MAC-SETUP.md; Step 0 verified on device"
git push
```
