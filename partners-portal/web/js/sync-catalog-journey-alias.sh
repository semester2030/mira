#!/usr/bin/env bash
# Keep catalog-journey.bags1.js identical to the canonical catalog-journey.js.
# Live dashboard loads catalog-journey.js; bags1 remains a legacy alias.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cp "$ROOT/catalog-journey.js" "$ROOT/catalog-journey.bags1.js"
echo "synced catalog-journey.bags1.js <- catalog-journey.js"
shasum -a 256 "$ROOT/catalog-journey.js" "$ROOT/catalog-journey.bags1.js"
