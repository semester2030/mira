# Face Intelligence Contract (Foundation)

**Version:** `face-intel-contract-v1`  
**Phase:** 4A–4F (Foundation → Validation)  
**Status:** Binding · Face Intelligence track complete through validation

## Relationship to Skin Intelligence

Sibling domain. Must not modify SVI, Skin canonical metrics, or FaceHealthMap schemas.

## Pipeline

```
Capture Quality + Face Presence + Pose
  → Measurement Eligibility (reuses cq-thresholds-v2.1)
  → Landmark Frame Summary (no raw MediaPipe buffers)
  → Geometry Anchors (from MediapipeLandmarkIndices, incl. jaw for 4C)
  → Face Geometry Engine (4B ratios / thirds / cautious symmetry)
  → Face Shape Classifier + Findings (4C)
  → Face Styling Recommendations (4D)
  → Face Intelligence Report DTO (4E) → MiraBeautyReport.faceIntelligence
  → Canonical Face Model
```

See also: `face_measurement_contract.md`, `face_findings_contract.md`, `face_recommendation_contract.md`, `face_report_contract.md`.

## Unavailable semantics

Identical discipline to Skin contract: never invent `0` / average / neutral.  
Geometry metrics unavailable without eligibility + anchors.  
Face shape unavailable without eligibility + anchors + sufficient hybrid signal.

## Eligibility

Uses `CAPTURE_QUALITY_THRESHOLDS` / Flutter `CaptureQualityThresholds` + `FaceGateRules` reason codes.  
No second threshold pack.

## Forbidden

- Attractiveness / beauty face score  
- Perfect Corp / YouCam as Face Intel source  
- Duplicating MediaPipe index ownership  
- Computing ratios/thirds/symmetry before Phase 4B  
- Face shape before Phase 4C  
## Versions

| Artifact | Id |
|----------|-----|
| Face model | `face-model-v1` |
| Face intel | `face-intel-v1` |
| Foundation | `face-foundation-v1` |
| Eligibility | `face-eligibility-v1` |
| Landmark frame | `landmark-frame-v1` |
| Geometry | `face-geometry-v1` / `face-geom-ratios-thirds-sym-v1` |
| Face shape | `face-shape-v1` / `face-shape-hybrid-ratios-v1` |
| Findings | `face-findings-contract-v1` |
| Recommendations | `face-reco-v1` / `face-styling-reco-v1` |
| Report | `face-report-v1` |
| Thresholds | `cq-thresholds-v2.1` |
