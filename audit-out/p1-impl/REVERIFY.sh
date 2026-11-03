#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/mira-api"
test -n "${DATABASE_URL:-}" || { echo "Set DATABASE_URL to a localhost Postgres URL"; exit 1; }
case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "REFUSE: DATABASE_URL must be local"; exit 1 ;;
esac
npm run check:field-registry
npm run test:editor-v2
cd "$ROOT"
flutter test test/features/marketplace/service_profile_json_parse_test.dart
echo REVERIFY_OK
