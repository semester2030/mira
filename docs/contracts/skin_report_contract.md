# Skin Report Contract

**Version:** `skin-report-contract-v1`  
**DTO:** `SkinIntelligenceReportDto`  
**Report version field:** `skin-report-v1`

## Required top-level fields

`analysisId`, `provider`, `formulaVersion`, `captureVersion`, `qualityVersion`, `skinVersion`, `intelligenceVersion`, `reportVersion`, `generatedAt`, `confidence`, `limitations`, `language`, `executiveSummaryAr`, `executiveSummaryEn`, `positiveFindings`, `priorityFindings`, `allFindings`, `metrics`, `svi`, `recommendations`, `progress`, `retakeGuidanceAr`, `retakeGuidanceEn`, `metadata`

## Metric row

Each metric row must include: id, bilingual display names, availability, confidence, source, limitations, recommendationEligible, explanation (why/how/evidence/confidence/limitations).

Unavailable rows must not invent `normalizedValue`.

## Sections

1. Executive summary (AR/EN)  
2. Positive findings  
3. Priority findings  
4. Metric table + explanations  
5. SVI block  
6. Recommendations  
7. Progress  
8. Retake guidance  
9. Metadata + limitations  

## Flutter binding

Flutter entity `SkinIntelligenceReport` must parse the same semantic fields. UI may only render DTO content — never provider JSON.

## Reproducibility

Given identical inputs (metrics, legacy, meta, capture versions), SVI score, findings set, and recommendation ids must be deterministic. `generatedAt` may differ and is excluded from golden comparisons.
