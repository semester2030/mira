#!/bin/bash
set -euo pipefail
DEV="${1:-00008110-00191986268BA01E}"
OUT="${2:-./mira_discover_device.log}"
TMP=$(mktemp -d)
xcrun devicectl device copy from --device "$DEV" \
  --domain-type appDataContainer --domain-identifier app.mira.beauty \
  --source "Library/Application Support/mira_discover_logs/mira_discover_device.log" \
  --destination "$TMP/mira_discover_device.log"
cp "$TMP/mira_discover_device.log" "$OUT"
echo "pulled -> $OUT ($(wc -l < "$OUT") lines)"
rg 'MIRA_BUILD_IDENTITY|MIRA_DISCOVER_FF|MIRA_DISCOVER_LOCK|MIRA_DISCOVER_CACHE|MIRA_DISCOVER_AUDIO|MIRA_DISCOVER_SWIPE' "$OUT" | head -80 || true
