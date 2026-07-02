#!/usr/bin/env bash
# Regenerate assets/fashion/colors.json and sync Dart catalog.
# Run from anywhere: bash scripts/sync_colors.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 scripts/generate_fashion_colors.py
dart run scripts/sync_fashion_catalog.dart
