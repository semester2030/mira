# Phase 2.1 Rollback

## Scope

Rollback only Phase 2.1 critical verification fixes (BlazeFace presence, confidence honesty, unified thresholds). Do not weaken Phase 0/1.

## Steps

1. Revert `BlazeFacePresenceDetector` / `FACE_PRESENCE_DETECTOR` wiring in `ai.module.ts`.
2. Restore structural-only `FaceGateService` only if emergency — **not recommended** (reopens API non-face → Perfect).
3. Revert `QualityConfidenceMapper` / `CaptureQualitySignals` provenance if client breaks.
4. Remove `@tensorflow/tfjs` + `@tensorflow-models/blazeface` deps if rolling back server detector.
5. Re-run: `test:phase0-integrity`, `test:phase1-ports`, `test:phase2-image-quality`, `test:phase2.1`, Flutter phase0/2 suites.

## Never

- Re-introduce `faceCount = 1` inferred from structural pass.
- Re-introduce fabricated `fromMeasuredQuality: true` fallbacks.
