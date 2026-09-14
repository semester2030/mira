# PROD-RC-1 — Source Identity

**Date:** 2026-08-11  
**Branch:** `cursor/phase2-platform-docs-9309`  
**HEAD:** `dca189c`

## Required identity

| Product | Release id | Certificate |
|---|---|---|
| Face Analysis Experience | `1.0.0-face-analysis-experience` | `MIRA-FACE-EXPERIENCE-FREEZE-1.0.0` |
| Fashion Knowledge | `1.0.0-fashion-knowledge` | `MIRA-FK-FREEZE-1.0.0` |

## Actual pin verification

| Check | Result |
|---|---|
| `FaceExperienceVersion` in working tree | PRESENT — version `1.0.0`, releaseId/certificate match |
| Fashion freeze certificate docs | PRESENT (`PHASE_FK14_*`) |
| Git tags for Face/Fashion freeze | **NONE** on this repo clone |
| Face package tracked in git | **0 files** (`git ls-files` empty) |
| Fashion-knowledge tree tracked | Entire `mira-api/src/fashion-knowledge/` **UNTRACKED** |
| Working tree dirty paths | ~1428 short-status lines (mostly governance docs) |

## Classification

**WORKING_TREE_QA / FREEZE_PIN_MATCH — NOT RELEASE_IDENTITY**

This is **not** declared `SOURCE IDENTITY MISMATCH` against a different audited tree: Phase 9O already recorded AD-FACE-05 (uncommitted freeze sources).  

However:

**DEPLOY / TAG / PRODUCTION RELEASE = BLOCKED** until a reviewed release commit lands and tags are cut.

## Inventory (production-relevant)

### Untracked directories (core)
- `lib/features/face_analysis_experience/` (~121 files)
- `lib/features/results_experience/` (~32 files)
- `mira-api/src/fashion-knowledge/` (~170 files)
- `mira-api/src/beauty-advisor/evidence/face-intelligence-projector.ts` (+ schema tests)
- Advisor Face/Fashion context entities/mappers/services (untracked)

### Modified tracked wiring (sample)
- `lib/core/config/mira_features.dart` (+ Face/Fashion dart-defines, defaults false)
- Navigation / capture panel / advisor screens / advisor.service / DTOs / modules
- `mira-api/package.json`, `nest-cli.json`, `.gitignore`

### Not auto-committed
Per PROD-RC-1 policy: change set shown; **no commit without explicit user approval**.
