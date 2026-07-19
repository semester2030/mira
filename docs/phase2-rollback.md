# Phase 2 Rollback

## Scope

Rollback Capture Quality & Reliable Face Foundation only. Do **not** weaken Phase 0 production integrity or Phase 1 provider ports.

## When to rollback

- False-positive quality blocks on known-good selfies at scale
- Server `ImageQualityPort` rejects valid provider-ready images
- Alignment introduces crop regressions vs preview
- Phase 0 / Phase 1 regression tests fail after deploy

## Rollback steps

1. **Feature disable (preferred):** keep ports; temporarily allow skin analyze to skip quality block only in non-production via ops flag if introduced — *do not* re-enable silent Perfect mock in production.
2. **Code rollback:** revert Phase 2 commits affecting:
   - `lib/features/skin_analysis/domain/image_quality/**`
   - `lib/features/skin_analysis/presentation/utils/face_image_processor.dart` (alignment)
   - `lib/features/skin_analysis/data/datasources/skin_analysis_api_data_source.dart`
   - `mira-api/src/ports/adapters/capture-image-quality.adapter.ts`
   - `mira-api/src/ports/image-quality/pixel-image-metrics.ts`
   - `mira-api/src/skin-analysis/skin-analysis.service.ts` (quality inject)
3. Restore Phase 1 adapter behavior (`iq-phase1-contract` unavailable signals) if needed.
4. Re-run:
   - `npm run test:phase0-integrity`
   - `npm run test:phase1-ports`
   - Flutter `phase0_truth_safety_test.dart`, `beauty_score_engine_test.dart`

## What must never be rolled back “for convenience”

- Phase 0: no silent Perfect mock in production
- Phase 0: YouCam audit redaction
- Phase 1: provider port boundaries / disabled try-on default

## Verification after rollback

Confirm skin upload path reaches provider again for lab golden selfies, and Phase 0/1 suites stay green.
