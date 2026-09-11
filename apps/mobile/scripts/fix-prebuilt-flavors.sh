#!/usr/bin/env bash
# Put the Debug (or Release) flavour of every prebuilt iOS framework in place.
#
# Why this exists: `pod install` can leave the *release* flavour of React Native core, its
# dependencies and Expo's prebuilt modules in Pods/, with the "last build configuration" marker
# files either missing or saying "debug". Each framework's swap build phase trusts its marker and
# skips, so a Debug build ends up mixing debug code compiled from source with release frameworks.
# Symptoms, both seen on 2026-09-11 right after adding a native dependency:
#   - link error: Undefined symbols facebook::react::Sealable / ShadowNode / RCTPackagerConnection
#   - once linked: instant crash at launch, EXC_BAD_ACCESS in facebook::react::Props::Props()
#     called from ExpoModulesCore (debug and release disagree on the size of Props)
#
# Usage (from anywhere):  apps/mobile/scripts/fix-prebuilt-flavors.sh [Debug|Release]
# Run it after every `pod install`, then build. See apps/mobile/CLAUDE.md.
set -euo pipefail

CONFIG="${1:-Debug}"
case "$CONFIG" in Debug|Release) ;; *) echo "usage: $0 [Debug|Release]" >&2; exit 2 ;; esac
OTHER=$([ "$CONFIG" = Debug ] && echo Release || echo Debug)
config_lower=$(echo "$CONFIG" | tr '[:upper:]' '[:lower:]')
other_lower=$(echo "$OTHER" | tr '[:upper:]' '[:lower:]')

MOBILE="$(cd "$(dirname "$0")/.." && pwd)"
PODS="$MOBILE/ios/Pods"
[ -d "$PODS" ] || { echo "No $PODS — run pod install / prebuild first." >&2; exit 1; }
cd "$PODS"

RN="$(cd "$MOBILE" && node -p "require('path').dirname(require.resolve('react-native/package.json'))")"
AUTOLINKING="$(cd "$MOBILE" && node -p "require('path').dirname(require.resolve('expo-modules-autolinking/package.json', {paths: [require.resolve('expo/package.json')]}))")"
RN_VERSION="$(node -p "require('$RN/package.json').version")"

# Each script skips when its marker already names the target, so claim the opposite first —
# a marker is exactly the thing that cannot be trusted here.
if [ -d React-Core-prebuilt ]; then
  printf '%s' "$OTHER" > React-Core-prebuilt/.last_build_configuration
  node "$RN/scripts/replace-rncore-version.js" -c "$CONFIG" -r "$RN_VERSION" -p "$PODS" | tail -1
fi
if [ -d ReactNativeDependencies ]; then
  printf '%s' "$OTHER" > ReactNativeDependencies/.last_build_configuration
  node "$RN/third-party-podspecs/replace_dependencies_version.js" -c "$CONFIG" -r "$RN_VERSION" -p "$PODS" | tail -1
fi
HERMES_VERSION="$(ls hermes-engine-artifacts 2>/dev/null | sed -n 's/^hermes-ios-\(.*\)-debug\.tar\.gz$/\1/p' | head -1)"
if [ -n "$HERMES_VERSION" ]; then
  # Hermes keeps its marker at the top of Pods/, not inside its own directory.
  printf '%s' "$OTHER" > .last_build_configuration
  node "$RN/sdks/hermes-engine/utils/replace_hermes_version.js" -c "$CONFIG" -r "$HERMES_VERSION" -p "$PODS" | tail -1
fi
for artifacts in */artifacts; do
  module="${artifacts%/artifacts}"
  [ -f "$artifacts/$module-$config_lower.tar.gz" ] || continue
  printf '%s' "$other_lower" > "$artifacts/.last_build_configuration"
  node "$AUTOLINKING/scripts/ios/replace-xcframework.js" -c "$config_lower" -m "$module" -x "$PODS/$module" | tail -1
done

echo "All prebuilt frameworks set to $CONFIG. Build again."
