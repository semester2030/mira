# Phase 2 — Worktree Classification

Classification is path-complete by explicit file for the 47 tracked
modifications (see `raw/01_git_baseline.txt`) and by exhaustive path group for
the 1,940 pre-Phase-2 untracked files.

## Tracked modifications

| Paths | State | Classification | Production/release handling |
|---|---|---|---|
| `.gitignore`, `mira-api/.gitignore` | MODIFIED | GOVERNANCE_ONLY | commit; controls safe candidate |
| `render.yaml`, `mira-api/package.json`, `mira-api/nest-cli.json` | MODIFIED | PRODUCTION_REQUIRED | commit |
| `ios/Runner/Info.plist` | MODIFIED | PRODUCTION_REQUIRED | commit |
| `lib/**` (all 21 listed modified paths) | MODIFIED | PRODUCTION_REQUIRED | commit |
| `mira-api/src/**` (all 14 listed modified paths) | MODIFIED | PRODUCTION_REQUIRED | commit |
| `partners-portal/web/status.html` | MODIFIED | PRODUCTION_REQUIRED | commit |
| `test/fashion_vision_to_engine_adapter_test.dart`, `test/outfit_intelligence_service_test.dart` | MODIFIED | TEST_REQUIRED | commit |
| `docs/index.html`, `docs/mira-production-transformation-program.html`, `docs/governance/PHASE_7B2_PROGRAM_COMPLETION_SUMMARY.md` | MODIFIED | GOVERNANCE_ONLY | commit |

There are no staged paths.

## Untracked exhaustive groups

| Path group | Count | Classification | Required? | Generated? | Candidate action |
|---|---:|---|---|---|---|
| `docs/governance/**` | 1,459 | GOVERNANCE_ONLY | release evidence | no | include after review |
| `docs/mira-*.html`, `docs/mira-*.css` | 6 | GOVERNANCE_ONLY | reference docs | no | include |
| `mira-api/src/fashion-knowledge/**` | 170 | PRODUCTION_REQUIRED | yes | no | include |
| `mira-api/src/production-entitlements/**` | 5 | PRODUCTION_REQUIRED / TEST_REQUIRED | yes | no | include |
| `mira-api/src/beauty-advisor/**` | 3 | PRODUCTION_REQUIRED | yes | no | include |
| `mira-api/src/vision/phase-prod-closure1-*.ts` | 1 | TEST_REQUIRED | yes | no | include |
| `mira-api/src/subscriptions/phase-prod-closure1-*.ts` | 1 | TEST_REQUIRED | yes | no | include |
| `lib/features/face_analysis_experience/**` | 121 | PRODUCTION_REQUIRED | yes | no | include |
| `lib/features/results_experience/**` | 32 | PRODUCTION_REQUIRED | yes | no | include |
| `lib/features/advisor/**` | 5 | PRODUCTION_REQUIRED | yes | no | include |
| `lib/core/entitlements/**` | 4 | PRODUCTION_REQUIRED | yes | no | include |
| `lib/features/outfit_analysis/**` | 2 | PRODUCTION_REQUIRED | yes | no | include |
| `test/**` excluding `failures/` | 107 | TEST_REQUIRED | yes | golden images included | include |
| `test/face_analysis_experience/failures/**` | 20 | TEMPORARY | no | generated failed-golden output | exclude |
| `mira-api/scripts/at4r-*.sh` | 2 | TEST_REQUIRED | QA only | no | include |
| `mira-api/scripts/lan-forward.py` | 1 | LOCAL_MACHINE_ONLY | no | no | exclude |
| `mira-api/.env.qa.example` | 1 | GOVERNANCE_ONLY | template | no | include after secret review |

Counts are from the baseline before adding Phase 2 governance files.

## Ignored exhaustive groups

| Group | Classification | Action |
|---|---|---|
| `mira-api/node_modules/**`, `mira-api/dist/**` | GENERATED_REPRODUCIBLE | exclude |
| `build/**`, `.dart_tool/**`, platform build output | BUILD_ARTIFACT | exclude |
| CocoaPods / iOS generated build support | GENERATED_REPRODUCIBLE | exclude unless already tracked lock/config |
| `.venv-brand/**`, `.venv-face/**`, `__pycache__/**` | LOCAL_MACHINE_ONLY | exclude |
| `.DS_Store` | LOCAL_MACHINE_ONLY | exclude |
| `mira-api/.env` | SECRET_OR_SENSITIVE | exclude; never document values |
| `ios/Flutter/Signing.xcconfig.local` | SECRET_OR_SENSITIVE / LOCAL_MACHINE_ONLY | exclude |

The only ignored files under source-like roots are `.DS_Store`, Python cache,
the local signing file, and `.env`. No real Dart/TypeScript production source
is ignored.

## Unknowns

No unexplained production-relevant path group remains. Individual governance
documents still require editorial review before a commit, but they are not
runtime dependencies.
