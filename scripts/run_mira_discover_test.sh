#!/bin/sh
# Test build only. Does not change the production default of MIRA_MARKETPLACE_ENABLED.
cd "$(dirname "$0")/.." || exit 1
exec flutter run --dart-define=MIRA_MARKETPLACE_ENABLED=true "$@"
