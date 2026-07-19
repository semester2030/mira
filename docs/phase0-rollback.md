# Phase 0 Rollback

## What changed
- Production integrity gate in `mira-api/src/main.ts` via `assertProductionIntegrity`
- Perfect Corp silent mock fallback disabled in production
- `render.yaml`: `PERFECT_CORP_FALLBACK_MOCK=false`
- Skin Vitality Index display + provenance + disclaimer
- Redacted YouCam audit (no full `rawYouCam` persistence)
- Legacy outfit mock blocked in production

## Rollback steps
1. Revert the Phase 0 commits / restore previous files for:
   - `mira-api/src/main.ts`
   - `mira-api/src/ai/mocks/perfect-corp-skin.provider.ts`
   - `mira-api/src/skin-analysis/skin-analysis.service.ts`
   - `mira-api/src/intelligence/*` provenance/copy changes
   - `render.yaml` (set `PERFECT_CORP_FALLBACK_MOCK` only if you intentionally re-enable — **not recommended**)
2. On Render Dashboard: ensure env matches blueprint after redeploy.
3. Redeploy `mira-api`.
4. Historical DB rows remain readable (`overallBeautyScore` field unchanged).

## Emergency note
Do **not** set `PERFECT_CORP_FALLBACK_MOCK=true` in production to “fix” outages — users will see fabricated skin results. Prefer Service Unavailable + retry.
