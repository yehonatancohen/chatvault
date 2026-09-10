# MAC-SETUP.md — building the iOS dev client on a Mac

**Temporary.** This file exists to get an iPhone build running. Delete it once Step 0 has fully
passed on a device (see the last section).

The goal: produce a custom Expo **dev client** with the WhatsApp Share Extension, install it on
a physical iPhone, share a real chat export into it, and confirm the handoff works. Nothing
here builds a shippable app — it proves the entry point.

**This has been done once and Step 0 passed on it** — a tens-of-MB with-media export handed
off successfully. What follows is the route that actually worked, with the things that went
wrong called out; most of the pain was not in Xcode.

**Route A (free personal-team signing) is enough.** The earlier belief that a Share Extension
needs a paid Apple Developer account was wrong: that only holds when there is no Mac and you
must build through EAS. On a Mac, a free Apple ID signs both targets fine.

---

## 0. Prerequisites

- **macOS** with **Xcode** from the App Store, opened once to finish component install.
- **Accept the Xcode licence** — until you do, even `git` fails with a licence error:
  ```bash
  sudo xcodebuild -license accept
  ```
- **Homebrew.** Needed for CocoaPods; see the warning below.
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"
  ```
- **CocoaPods — install it with Homebrew, not `gem`:**
  ```bash
  brew install cocoapods
  ```
  > **`sudo gem install cocoapods` does not work on modern macOS.** Apple's system Ruby (2.6)
  > ships no development headers, so building the `nkf` native extension fails with
  > `mkmf.rb can't find header files for ruby`. There is no fix short of a non-system Ruby;
  > Homebrew's formula bundles its own and sidesteps it entirely.
- **Node ≥ 20.** The official installer is simplest. Note the macOS `.pkg` on nodejs.org is
  **universal — there is no `-darwin-arm64.pkg`**, that URL 404s. Use
  `https://nodejs.org/dist/v22.x.y/node-v22.x.y.pkg`.
- **pnpm 10.14.0**: `corepack enable && corepack prepare pnpm@10.14.0 --activate`
- A **physical iPhone** with **WhatsApp**, plus a USB cable. The iOS Simulator has no WhatsApp
  and does not reliably surface share-sheet extensions — it cannot prove this step. (It is
  still the right tool for debugging a *launch crash*; see `apps/mobile/CLAUDE.md`.)
- A real WhatsApp chat you can **Export chat → With media**. Use a big one (tens of MB or
  more). A 5 KB text-only export passes even when a 200 MB one would crash, so it proves
  nothing.

---

## 1. Get the code

```bash
git clone https://github.com/yehonatancohen/chatvault.git
cd chatvault
pnpm install            # from the repo root
```

---

## 2. Generate the native project

```bash
cd apps/mobile
pnpm prebuild --platform ios   # generates ios/ with the Share Extension target, runs pod install
```

`prebuild` uses `--clean`, so **only run it the first time or after a config-plugin change** —
it regenerates the Xcode project and wipes the signing you set below. For a plain dependency
bump that moves pod versions, run `cd ios && pod install` instead.

---

## 3. Sign both targets in Xcode

```bash
open ios/ChatVault.xcworkspace
```

Note the capitalisation, and that it is the **`.xcworkspace`**, not the `.xcodeproj`.

In the Project Navigator (**⌘1**), click the top **blue project icon** named `ChatVault` — not
a folder. The editor then shows `PROJECT` and `TARGETS` headings. For **each** of the two
targets — **`ChatVault`** and **`ChatVaultImport`** — open **Signing & Capabilities** and:

- tick **Automatically manage signing**
- set **Team** to your personal team (add your Apple ID first under Xcode → Settings → Accounts)
- confirm the App Group **`group.app.chatvault.mobile`** is present

The extension is a separate target and Xcode will not sign it for you. If you hit *"Failed to
register bundle identifier"*, the id is taken on another Apple ID — change
`ios.bundleIdentifier` in `apps/mobile/app.json` and re-run prebuild.

---

## 4. Build onto the phone

Plug in the iPhone, unlock it, tap **Trust This Computer**. Confirm it is visible:

```bash
xcrun xctrace list devices
```

Then either hit **▶ Run** in Xcode, or:

```bash
pnpm ios --device
```

First build is slow (Hermes plus ~108 pods). Afterwards, on the phone: **Settings → General →
VPN & Device Management → trust** the developer profile.

---

## 5. Connect the dev client to Metro

```bash
cd apps/mobile
pnpm start                   # expo start --dev-client
```

Open the ChatVault dev client on the iPhone. If it sits on "searching for development servers",
make sure the phone is on the **same Wi-Fi** as the Mac and enter the URL manually —
`http://<mac-lan-ip>:8081`. The "log in to Expo" prompt is optional; skip it.

---

## 6. The Step 0 check

1. On the iPhone: **WhatsApp → a real chat → chat name → Export Chat → With Media**.
2. In the share sheet, choose **ChatVault**.
3. The extension should hand off **immediately**. If it spins or the share sheet dies on a
   large export, the extension is doing work it must not do (it has ~120 MB) — that is the
   finding, stop here and report it.
4. On the **Import** screen, confirm:
   - the file arrived and its size on disk reads correctly;
   - a `.zip` (with-media) export is **measured, not read** — size and a note, no parse numbers;
   - a text export shows message count, media count, participants, date range, dialect. Check
     these against the chat in WhatsApp.
   - there is a working way back to the library.

**Gate:** a with-media export lands in the App Group container and the host app reports its
size without the extension being killed. Pass → Track A can start.

---

## 7. Troubleshooting

Most of what went wrong was dependency resolution, not Xcode. Read
`apps/mobile/CLAUDE.md` → **"Dependency pinning is load-bearing here"** before touching
versions.

| Symptom | Fix |
|---|---|
| `sudo gem install cocoapods` fails on `nkf` / `mkmf.rb can't find header files` | Expected on system Ruby. `brew install cocoapods`. |
| `git` reports an Xcode licence error | `sudo xcodebuild -license accept` |
| `Command "prebuild" not found` | You are in the repo root. `cd apps/mobile` first. |
| App launches then dies: `[runtime not ready]: TypeError: Object is not a function` | A JS/native or peer-dependency version split. Run `pnpm exec expo install --check` and treat pnpm's "unmet peer" warnings as errors. Debug it on the **simulator** — see `apps/mobile/CLAUDE.md`. |
| Metro: `Unable to resolve "./parser/parse.js" from packages/core/src/index.ts` | `apps/mobile/metro.config.js` is missing or was "cleaned up". It maps `core`'s NodeNext `.js` specifiers onto `.ts`. |
| Sharing lands on **"Unmatched Route"** | `app/+native-intent.ts` is missing. The extension reopens the app with a signal URL that matches no route. |
| Signing works for the app but not the extension | Sign **both** targets. `ChatVaultImport` is separate. |
| Dev client can't reach Metro | Same Wi-Fi, or enter `http://<mac-ip>:8081` by hand. |
| `File` / `Directory` import errors at runtime | You are in Expo Go. This must be the custom dev client. |

---

## 8. Step 0 has passed — this file can go

A real chat exported **with media**, tens of MB, was shared into the app on a physical iPhone:
the extension was not killed and the host app reported the file. See `ROADMAP.md` → Step 0.

This file is kept only because the setup is not yet reproducible from scratch by anyone else —
delete it once someone has followed it end to end on a second machine, or once it is folded
into `apps/mobile/CLAUDE.md`:

```bash
git rm MAC-SETUP.md
git commit -m "Remove MAC-SETUP.md; setup folded into apps/mobile/CLAUDE.md"
```
