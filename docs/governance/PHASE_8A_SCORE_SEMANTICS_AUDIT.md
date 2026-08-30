# PHASE 8A — Score Semantics Audit

## Observed scores

| Score | UI location | Direction today | Range | Source | Issues |
|-------|-------------|-----------------|-------|--------|--------|
| Skin Vitality / SVI / overallBeautyScore | BeautyScoreHero + SkinIntelligence | Higher better | ~0–100 | Frozen intel + report | Duplicated; version leaked in SkinIntelligence |
| Concern UI scores (moisture, etc.) | Concerns via local builder | Higher → severity `none` (≥78) | 0–100 | `local_mira_report_builder._severity` | Higher is better for concerns; opposite of “acne severity” mental model |
| Metric confidence | SkinIntelligence | Higher better | 0–1 or percent | intel | Same typography as condition |
| Product matchScore | _ProductsSection | Higher better | 0–100 | MiraBeautyReport products | Shown even at modest % (`تطابق ${p.matchScore}%`) |
| Progress delta / projectedOverallScore30Days | ProgressForecast | Higher better assumed | derived | `local_progress_builder` | Projection vs measurement indistinct |
| Skin age comparison | SkinAgeComparisonCard | Age-like | years | report | Needs confidence gate |
| Map intensity | Face map | Severity tiers from score | high/med/low | `local_face_map_builder` + `ReportFaceMapSpec` | Not pixel severity |

## Ambiguity findings
1. Concern scores use “higher = healthier” while users may read high acne as worse.  
2. Confidence and vitality both numeric near each other.  
3. English word “Trends” in Arabic summary (`local_progress_builder`).  
4. Projection 30-day score looks like a measurement.

## Proposed Score Semantics Contract
| Field | Definition |
|-------|------------|
| scoreType | `condition_health` \| `condition_burden` \| `confidence` \| `match` \| `projection` \| `age_estimate` |
| direction | `higher_better` \| `higher_worse` \| `neutral` |
| statusLabel | Public AR/EN from thresholds policy only |
| colorPolicy | Health greens for condition_health; amber/red for burden; separate blue-gray for confidence; dashed for projection |
| confidenceDisplay | Never reuse condition ring |
| comparisonEligible | Boolean from Progress Comparability Contract |
| userExplanation | One sentence, no internals |
| fallback | Hide number; show qualitative or “غير متاح” |
