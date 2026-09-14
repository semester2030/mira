# PROD-RC-1 — Release Commit / Tag Plan

**Status:** PREPARED · **NOT EXECUTED**

## Proposed commit scope (review first)

Include only freeze/activation wiring for Face + Fashion + required navigation/advisor/projector:

- `lib/features/face_analysis_experience/`
- `lib/features/results_experience/` (if required by Result Mirror entry — confirm coupling)
- Face/Fashion flag + route wiring under `lib/core/**`, advisor, capture panel, dashboard entry
- `mira-api/src/fashion-knowledge/`
- `mira-api/src/beauty-advisor/evidence/**` (Face trust projector)
- Advisor module/service/DTO changes for Face/Fashion envelope
- Tests under `test/face_analysis_experience/` and fashion schema tests
- `mira-api/.env.qa.example` (no secrets)
- Selected governance PROD_RC1 / freeze docs

## Exclude from release commit
- `.env`, `.env.qa`, credentials, local secrets
- Unrelated massive governance churn if splitting PRs preferred
- Production flag enablement in `render.yaml`

## Proposed messages (draft)

1. `chore(release): pin Face Analysis Experience 1.0.0 freeze sources`
2. `chore(release): pin Fashion Knowledge 1.0.0 platform sources`
3. Or single: `release: Face Experience + Fashion Knowledge 1.0.0 freeze commit`

## Proposed tags (after commit on agreed branch)

- `1.0.0-face-analysis-experience`
- `MIRA-FACE-EXPERIENCE-FREEZE-1.0.0`
- `1.0.0-fashion-knowledge`
- `MIRA-FK-FREEZE-1.0.0`

Optional annotated RC tag later: `prod-rc1-candidate` — only after QA E2E PASS.

## Gate
**Await explicit user instruction to commit and tag.** Do not push without ask.
