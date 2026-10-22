#!/bin/bash
# RC14: only re-sign objective_c.framework when its signature is invalid.
# Never re-sign Runner.app without extracted entitlements (strips application-identifier).
set -euo pipefail
APP="${1:-/Users/fayez/Desktop/mira/build/ios/iphoneos/Runner.app}"
ID="${2:-Apple Development: TARIQ ALDALBAHI (P9C9QSDZY9)}"
LOGDIR="$(dirname "$0")"
{
  echo "APP=$APP"
  echo "IDENTITY=$ID"
  echo "BUILD=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist" 2>/dev/null || true)"
} | tee "$LOGDIR/codesign-verify.txt"

OBJC_FW="$APP/Frameworks/objective_c.framework"
OBJC_BIN="$OBJC_FW/objective_c"
if [[ -f "$OBJC_BIN" ]]; then
  otool -l "$OBJC_BIN" | awk '/LC_BUILD_VERSION/{p=1} p&&/platform/{print; exit}' | tee -a "$LOGDIR/codesign-verify.txt"
  PLATFORM=$(otool -l "$OBJC_BIN" | awk '/LC_BUILD_VERSION/{p=1} p&&/platform/{print $2; exit}')
  if [[ "$PLATFORM" == "7" ]]; then
    echo "ERROR: objective_c is simulator platform 7 — clean native_assets and rebuild" | tee -a "$LOGDIR/codesign-verify.txt"
    exit 2
  fi
  if ! codesign --verify --verbose=2 "$OBJC_FW" >/tmp/objc-verify.out 2>&1; then
    echo "objective_c signature invalid — re-signing framework only" | tee -a "$LOGDIR/codesign-verify.txt"
    codesign --force --sign "$ID" --timestamp=none --generate-entitlement-der "$OBJC_FW" 2>&1 | tee -a "$LOGDIR/codesign-verify.txt"
  else
    echo "objective_c already valid — leave Flutter/Xcode signatures intact" | tee -a "$LOGDIR/codesign-verify.txt"
  fi
  codesign -dvvv "$OBJC_FW" 2>&1 | tee "$LOGDIR/objective_c-codesign.txt" | rg 'Identifier|Authority|TeamIdentifier|Format' || true
  codesign --verify --verbose=2 "$OBJC_FW" 2>&1 | tee -a "$LOGDIR/objective_c-codesign.txt"
fi

# Verify app still has application-identifier (do not strip by re-signing)
codesign -d --entitlements :- "$APP" 2>/dev/null | tee "$LOGDIR/app-entitlements.plist" | rg -n 'application-identifier|get-task-allow|aps-environment' || true
if ! rg -q 'application-identifier' "$LOGDIR/app-entitlements.plist"; then
  echo "ERROR: Runner.app missing application-identifier entitlement" | tee -a "$LOGDIR/codesign-verify.txt"
  exit 3
fi
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tee -a "$LOGDIR/codesign-verify.txt" || true
codesign -dvvv "$APP" 2>&1 | tee "$LOGDIR/app-codesign-details.txt" | rg 'Identifier|Authority|TeamIdentifier|Format|Sealed Resources' || true

ILLU="$APP/Frameworks/App.framework/flutter_assets/assets/icons/fashion/illustrations"
COUNT=$(find "$ILLU" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "illustration_files=$COUNT" | tee "$LOGDIR/illustrations-count.txt"
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist" | tee "$LOGDIR/installed-build-number.txt"
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist" | tee -a "$LOGDIR/installed-build-number.txt"
echo "OK"
