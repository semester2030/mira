# Replay commands

API (PORT 3011, local DB only):

cd mira-api
set -a; source .env.jamalak-test; set +a
node dist/main.js

Partner-editor publish:

node --env-file=.env.jamalak-test src/marketplace/taxonomy/discover-all-close-partner-publish.mjs

Widget:

flutter test test/features/marketplace/beauty_one_level_back_widget_test.dart test/features/marketplace/children_all_scope_widget_test.dart

Connected Flutter (needs a buildable device target):

python3 -c "import json; print(json.dumps(json.load(open('docs/jamalak-dual-reg/evidence/all-close-mwezcxyi-8dc6/PUBLISHED_OFFERS.json')), separators=(',',':')))" > /tmp/manifest.json
flutter test integration_test/discover_all_close_connected_test.dart -d macos \
  --dart-define=USE_MIRA_API=true \
  --dart-define=MIRA_API_BASE_URL=http://127.0.0.1:3011/api/v1 \
  --dart-define=MIRA_MARKETPLACE_ENABLED=true \
  --dart-define=MIRA_ALL_CLOSE_MANIFEST_JSON="$(cat /tmp/manifest.json)" \
  --dart-define=MIRA_GIT_HEAD=$(git rev-parse --short HEAD)
