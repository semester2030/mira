# Phase 4.5 Rollback — Face Production Integration

## What 4.5 added

Production bridge only:

1. Multipart `faceIntel` on skin-analysis (Flutter upload + Nest controllers).
2. `parseFaceIntelInput` + pass-through to `IntelligenceService.buildBeautyReport({ faceIntel })`.
3. `FaceMeshService.extractFaceIntelLandmarks` + `FaceIntelUploadPayload` / `FaceIntelProductionBridge`.
4. `SkinCaptureQualityGate` returns `faceIntelJson`.
5. Docs + `test:phase4_5` / `phase4_5_face_production_test.dart`.

**Did not** change geometry/shape/recommendation/report algorithms (4A–4F).

## Rollback steps

1. **API:** Stop reading `body.faceIntel` in `ai-gateway.controller` / `skin-analysis.controller`; remove third arg from `SkinAnalysisService.analyze`.
2. **API:** Remove `faceIntel` option pass in `buildBeautyReport` call (leave `IntelligenceService` optional param intact for library use).
3. **Flutter:** Remove `faceIntel` from `FormData` in `SkinAnalysisApiDataSource`; revert `SkinCaptureQualityGate.run` to `(readyFile, report)` only.
4. **Optional cleanup:** Delete `parse-face-intel-input.ts`, upload payload/bridge files, Phase 4.5 tests/docs.

After rollback:

- `miraReport.faceIntelligence` remains `undefined` in production (libraries still callable in tests).
- Skin analysis + FaceHealthMap continue unchanged.
- Phases 4A–4F unit suites remain valid.

## Risk if rolled back

Face Intelligence section disappears from production reports until re-wired. No skin-score or marketplace regression expected.
