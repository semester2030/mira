# Flutter Face Engine Ownership

## Why Flutter Face pipelines exist

They were created in Phases 4A–4D as **on-device mirrors** of the NestJS Face Intelligence engines for:

1. **Testing** — deterministic Dart unit tests without spinning Nest  
2. **Future offline roadmap** — possible guest/offline Face Intel (not implemented)  
3. **Contract parity** — keep Flutter formulas aligned with API during development  

They are **not** the production Face Report path after Phase 4.5.

## Classification matrix

| Component | Role | Production callers (`lib/`) | Test callers | Decision |
|-----------|------|----------------------------|--------------|----------|
| `FaceFoundationPipeline` | Testing / Future offline | **None** | `phase4a_*` | **Keep + gate** (Deprecate for prod exec) |
| `FaceGeometryPipeline` | Testing / Future offline | **None** | `phase4b_*` | **Keep + gate** |
| `FaceGeometryEngine` | Testing / Future offline | **None** | `phase4b_*` | **Keep + gate** |
| `FaceFeaturesPipeline` | Testing / Future offline | **None** | `phase4c/d_*` | **Keep + gate** |
| `FaceShapeClassifier` | Testing / Future offline | **None** | `phase4c/d_*` | **Keep + gate** |
| `FaceFindingEngine` | Testing / Future offline | via features pipeline | tests | **Keep + gate** (via pipeline) |
| `FaceRecommendationPipeline` | Testing / Future offline | **None** | `phase4d_*` | **Keep + gate** |
| `FaceRecommendationEngine` | Testing / Future offline | **None** | `phase4d_*` | **Keep + gate** |
| `GeometryAnchorExtractor` | **Production** | `FaceMeshService.extractFaceIntelLandmarks` | tests | **Keep** |
| `FaceIntelUploadPayload` / `FaceIntelProductionBridge` | **Production** | quality gate → API upload | tests | **Keep** |
| `MeasurementEligibility` (Flutter) | Testing / Future offline | via foundation mirror | `phase4a_*` | **Keep** (API owns prod eligibility) |
| `canonical_face_model.dart` (Flutter) | Testing / Future offline | via mirrors | tests | **Keep** |

## Prevention of accidental production execution

`FaceClientMirrorGate.allowMirrorExecution` defaults to **false**.  
All Flutter Face*Pipeline / engine entry points call `assertMirrorAllowed`.  
Tests set `allowMirrorExecution = true` in `setUpAll`.

## Production SoT

**Only** `mira-api` `runFaceReportPipeline` builds `MiraBeautyReport.faceIntelligence` in production.
