# Phase 3 Rollback

## What Phase 3 added

- `mira-api/src/intelligence/skin-intelligence/**`
- `skinIntelligence` on `MiraBeautyReport`
- SVI calculation version `svi-v2`
- Flutter `SkinIntelligenceReport` + `SkinIntelligenceSection`
- `npm run test:phase3-skin-intel`

## Rollback steps

1. Revert `IntelligenceService.buildBeautyReport` to call `computeBeautyScore` and omit `skinIntelligence`.
2. Set `SKIN_VITALITY_CALCULATION_VERSION` back to `svi-v1` in `result-provenance.ts`.
3. Stop passing `portMetrics` from `SkinAnalysisService` (optional; harmless if unused).
4. Remove Flutter section binding (optional; null-safe if field absent).
5. Redeploy API; clients ignore unknown fields.

## Data safety

- Stored `overallBeautyScore` remains numeric — historical reads work.
- New `skinIntelligence` blobs are additive JSON; older clients ignore them.

## Do not rollback

- Phase 0 integrity, Phase 1 ports, Phase 2 / 2.1 capture quality (unless separately approved).
