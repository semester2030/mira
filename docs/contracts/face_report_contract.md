# Face Report Contract

**Version:** `face-report-contract-v1`  
**DTO:** `FaceIntelligenceReportDto`  
**Report version field:** `face-report-v1`

## Relationship

Sibling field on `MiraBeautyReport.faceIntelligence` — parallel to `skinIntelligence`.  
**Never** overload `FaceHealthMap` / `faceHealthMap` with Face Intelligence schema.

## Required top-level fields

`analysisId`, `provider`, `formulaVersion`, `captureVersion`, `faceVersion`, `intelligenceVersion`, `geometryVersion`, `geometryFormulaId`, `shapeVersion`, `shapeFormulaId`, `recommendationVersion`, `recommendationEngineId`, `reportVersion`, `generatedAt`, `confidence`, `limitations`, `language`, `executiveSummaryAr`, `executiveSummaryEn`, `measurementEligible`, `eligibilityReasonCodes`, `shape`, `findings`, `notableFindings`, `metrics`, `recommendations`, `featureLayers`, `retakeGuidanceAr`, `retakeGuidanceEn`, `metadata`

## Sections

1. Executive summary (AR/EN)  
2. Shape block  
3. Findings / notable findings  
4. Metrics (geometry + shape) with provenance — unavailable must not invent values  
5. Feature layers (styling narratives — not skin heatmap)  
6. Styling recommendations  
7. Retake guidance  
8. Metadata + limitations  

## Feature layers

Narrative overlays (`shape` · `proportion` · `symmetry_note`) for presentation.  
They are **not** measurement truth for skin concerns and must not replace FaceHealthMap.

## Flutter binding

Entity `FaceIntelligenceReport` parses the same semantic fields.  
UI (`FaceIntelligenceSection`) may only render DTO content — Premium/AppColors/AppTypography only.

## Forbidden

- Provider JSON leakage (`rawYouCam`, Perfect payloads)  
- Attractiveness / beauty ranking  
- Medical / scary clinical framing  
- Off-theme colors  
- Inventing unavailable metric values  
- Writing Face Intel into FaceHealthMap schema  

## Reproducibility

Given identical pipeline inputs, shape id, metric availabilities, finding ids, recommendation ids, and feature layer ids must be deterministic. `generatedAt` may differ and is excluded from golden comparisons.
