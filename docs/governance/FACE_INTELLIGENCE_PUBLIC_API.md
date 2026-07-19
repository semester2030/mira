# Face Intelligence — Public API Inventory (v1.0.0)

Owner package: `mira-api/src/intelligence/face-intelligence/`  
Public barrel: `index.ts`  
Flutter production surface: upload bridge + DTO parse + UI section (not Flutter Face*Pipeline mirrors).

## A. Production pipelines (API)

| Symbol | Purpose | Owner | Version | Compat |
|--------|---------|-------|---------|--------|
| `runFaceFoundationPipeline` | Eligibility + landmark summary + skeleton model | API | `face-foundation-v1` | Stable |
| `runFaceGeometryPipeline` | Ratios / thirds / symmetry | API | `face-geometry-v1` | Stable |
| `runFaceFeaturesPipeline` | Shape + findings | API | `face-shape-v1` | Stable |
| `runFaceRecommendationPipeline` | Evidence-backed styling recos | API | `face-reco-v1` | Stable |
| `runFaceReportPipeline` | **Sole production report builder** | API | `face-report-v1` | Stable |

## B. Models & DTOs

| Symbol | Purpose | Owner | Version | Compat |
|--------|---------|-------|---------|--------|
| `CanonicalFaceModel` / `CanonicalFaceMetric` | Provider-independent metrics | API | `face-model-v1` | Stable |
| `GeometryAnchors` / `NormPoint` | Normalized measurement input | API + Flutter extractor | `geometry-anchors-v1` | Stable |
| `PoseSignals` | Eligibility inputs | API | `face-eligibility-v1` | Stable |
| `LandmarkFrameSummary` | Landmark summary DTO | API | `landmark-frame-v1` | Stable |
| `FaceShapeClassification` | Shape outcome | API | `face-shape-v1` | Stable |
| `FaceFinding` | Finding schema | API | findings contract | Stable |
| `FaceRecommendation` | Recommendation schema | API | `face-reco-v1` | Stable |
| `FaceIntelligenceReportDto` | Client report sibling | API | `face-report-v1` | Stable |
| `FaceFeatureLayer` | Narrative styling layers | API | report | Stable |
| `FaceIntelRuntimeStateDto` | Explicit runtime status | API + Flutter | `face-runtime-states-v1` | Stable |
| `ParsedFaceIntelPackage` | Parse result (runtime + input) | API | operational | Stable |
| `MiraBeautyReport.faceIntelligence` | Sibling field on beauty report | Intelligence | report | Optional field |
| `MiraBeautyReport.faceIntelligenceRuntime` | Sibling runtime | Intelligence | runtime | Optional field |

## C. Enums / unions

| Symbol | Purpose | Compat |
|--------|---------|--------|
| `FaceShapeId` | oval/round/square/… | Stable set; additive only via MAJOR |
| `FaceFindingCategory` / `FaceFindingSeverity` | Finding taxonomy | Stable |
| `FaceRecommendationCategory` | Reco taxonomy | Stable |
| `FaceIntelRuntimeStatusWire` | AVAILABLE/UNAVAILABLE/FAILED/SKIPPED/NOT_REQUESTED | Stable |
| `MeshRegionId` | Region id strings | Stable |

## D. Contracts (docs)

| Document | Version |
|----------|---------|
| `docs/contracts/face_intelligence_contract.md` | `face-intel-contract-v1` |
| `docs/contracts/face_measurement_contract.md` | measurement |
| `docs/contracts/face_findings_contract.md` | findings |
| `docs/contracts/face_recommendation_contract.md` | reco |
| `docs/contracts/face_report_contract.md` | report |
| `docs/contracts/face_validation_contract.md` | `face-validation-v1` |

## E. Provider / ports

| Symbol | Purpose | Notes |
|--------|---------|-------|
| `GeometryAnchors` input | Provider-independent geometry | MediaPipe extracts on device; engines never import MediaPipe/Perfect |
| `parseFaceIntelPackage` | Multipart bridge | Production upload contract |
| Skin Perfect Corp | Out of Face Intel scope | Sibling Skin Intelligence only |

## F. Flutter production public surface

| Symbol | Purpose | Role |
|--------|---------|------|
| `GeometryAnchorExtractor` | Anchors from normalized landmarks | Production |
| `FaceIntelProductionBridge` / `FaceIntelUploadPayload` | Upload JSON + runtime | Production |
| `FaceIntelRuntimeState` | Client runtime model | Production |
| `FaceIntelligenceReport.tryParse` | DTO deserialize | Production |
| `FaceIntelligenceSection` | UI | Production |
| `FaceIntelRuntimeNotice` | UI for non-AVAILABLE | Production |
| `FaceClientMirrorGate` | Block mirror pipelines | Production protection |
| Flutter Face*Pipeline / engines | Mirrors | **Testing / Future offline only** — not public production API |

## G. Events

No Face Intelligence domain event bus in v1.0.0. Persistence is via `skinAnalysis.resultJson.miraReport`.

## H. Validation / audit exports

| Symbol | Purpose |
|--------|---------|
| `auditFaceIntelligencePipeline` / `assertContractOk` | Contract auditors |
| `FACE_ANALYSIS_FIXTURES` / goldens | Validation fixtures |
| `runEngineeringLawAudit` | Operational eng-law report |

## Undocumented public APIs

None intended beyond `index.ts` + Flutter surfaces listed above. Internal files under `operational/` are tooling, not product API.
