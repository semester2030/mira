# Face Intelligence — Version Manifest v1.0.0

| Field | Value |
|-------|--------|
| **Product** | Mira Face Intelligence |
| **Release version** | **1.0.0** |
| **Status** | Production Approved · **Frozen** |
| **Release date** | 2026-07-19 |
| **Machine-readable** | `mira-api/src/intelligence/face-intelligence/FACE_INTELLIGENCE_VERSION_MANIFEST.json` |

## Component version identifiers

| Layer | Identifier | Constant / source |
|-------|------------|-------------------|
| Architecture lock | `face-intel-arch-lock-v1` | `docs/architecture/face-intelligence-architecture-lock.md` |
| Intelligence | `face-intel-v1` | `FACE_INTELLIGENCE_VERSION` |
| Canonical model | `face-model-v1` | `FACE_MODEL_VERSION` |
| Foundation | `face-foundation-v1` | `FACE_FOUNDATION_VERSION` |
| Eligibility | `face-eligibility-v1` | `MEASUREMENT_ELIGIBILITY_VERSION` |
| Landmark frame | `landmark-frame-v1` | `LANDMARK_FRAME_VERSION` |
| Geometry anchors | `geometry-anchors-v1` | `GEOMETRY_ANCHORS_VERSION` |
| Geometry | `face-geometry-v1` | `FACE_GEOMETRY_VERSION` |
| Geometry formula | `face-geom-ratios-thirds-sym-v1` | `FACE_GEOMETRY_FORMULA_ID` |
| Shape / findings engine | `face-shape-v1` | `FACE_SHAPE_VERSION` |
| Shape formula | `face-shape-hybrid-ratios-v1` | `FACE_SHAPE_FORMULA_ID` |
| Findings schema | `face-finding-v1` | findings contract |
| Recommendations | `face-reco-v1` | `FACE_RECOMMENDATION_VERSION` |
| Reco engine | `face-styling-reco-v1` | `FACE_RECOMMENDATION_ENGINE_ID` |
| Report | `face-report-v1` | `FACE_REPORT_VERSION` |
| Contract | `face-intel-contract-v1` | `FACE_CONTRACT_VERSION` |
| Validation | `face-validation-v1` | `FACE_VALIDATION_VERSION` |
| Localization | `ar+en` | report `language` |
| Capture quality | `cq-thresholds-v2.1` | shared with skin capture |
| Compatibility | `face-compat-v1` | this freeze |
| Runtime states | `face-runtime-states-v1` | Operational Hardening |

## SemVer policy (release)

- **MAJOR** (x.0.0): breaking DTO/contract/pipeline behavior  
- **MINOR** (1.x.0): additive optional fields / new metrics with unavailable defaults  
- **PATCH** (1.0.x): docs, tests, non-behavioral fixes  

Changing any formula id or removing a DTO field requires a **MAJOR** bump and Change Request approval.

## Production path (frozen)

```
Capture → Quality → MediaPipe anchors → faceIntel multipart
  → parseFaceIntelPackage → runFaceReportPipeline (once)
  → MiraBeautyReport.faceIntelligence + faceIntelligenceRuntime
  → Flutter mapper → FaceIntelligenceSection | FaceIntelRuntimeNotice
```
