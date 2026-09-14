# Phase 2 Final — Staged Source Manifest

Staged after explicit allowlist `git add` (no `git add .` / `git add -A`).

## Totals

- Staged paths: `1,987`
- Modified tracked: `47`
- Newly added: `1,940`
- Unstaged remaining untracked: `21` (20 golden `failures/**` + `mira-api/scripts/lan-forward.py`)
- Index secret/credential filenames: none

## Categories

| Category | Count | Classification |
|---|---:|---|
| Other governance docs | 1,450 | GOVERNANCE_ONLY |
| Fashion Knowledge API | 170 | PRODUCTION_REQUIRED |
| Face Experience | 121 | PRODUCTION_REQUIRED |
| Tests (excluding failures) | 109 | TEST_REQUIRED |
| Results Experience | 32 | PRODUCTION_REQUIRED |
| Phase 2 governance | 15 | GOVERNANCE_ONLY |
| Other Flutter lib | 12 | PRODUCTION_REQUIRED |
| Phase 1 governance | 10 | GOVERNANCE_ONLY |
| Advisor client | 9 | PRODUCTION_REQUIRED |
| Other docs | 8 | GOVERNANCE_ONLY |
| Fashion client | 7 | PRODUCTION_REQUIRED |
| Other API | 7 | PRODUCTION_REQUIRED |
| Config / ignore / example env | 6 | PRODUCTION_REQUIRED / GOVERNANCE_ONLY |
| Phase 2 Final pre-commit evidence | 6 | GOVERNANCE_ONLY |
| production-entitlements | 5 | PRODUCTION_REQUIRED / TEST_REQUIRED |
| Client entitlements | 4 | PRODUCTION_REQUIRED |
| Commerce | 4 | PRODUCTION_REQUIRED / TEST_REQUIRED |
| Advisor API | 3 | PRODUCTION_REQUIRED |
| Beauty Advisor additions | 3 | PRODUCTION_REQUIRED |
| AT-4R QA scripts | 2 | TEST_REQUIRED |
| Integrity config | 2 | PRODUCTION_REQUIRED |
| iOS Info.plist | 1 | PRODUCTION_REQUIRED |
| Partners portal | 1 | PRODUCTION_REQUIRED |

## Explicitly not staged

- `test/face_analysis_experience/failures/**`
- `mira-api/scripts/lan-forward.py`
- `.env`, local signing, `node_modules`, `dist`, build caches, Desktop ZIP artifacts
