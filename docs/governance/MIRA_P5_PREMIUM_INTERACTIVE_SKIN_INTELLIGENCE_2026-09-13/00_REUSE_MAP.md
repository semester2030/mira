# Implementation map — MIRA-P5-PREMIUM-INTERACTIVE-SKIN-INTELLIGENCE-2026-09-13

## REUSE
| Owner | Role |
|---|---|
| `PerfectMaskSession` | mask lifecycle / lookup / subregions |
| `PerfectMaskOverlay` | ONE mask renderer (geometry unchanged) |
| `ResultsSkinMapPanel` | ONE Face Explorer |
| `_focusedConcernId` | selected metric |
| `MetricPresentationPolicy` | Arabic presentation map |
| `AppColors` / `AppTypography` / `AppSpacing` | Design System |
| `SkinClaimPolicy` | truth copy |

## EXTEND
| Owner | Change |
|---|---|
| `ResultsSkinMapPanel` | immersive levels, callouts, الأصل, richer selector |
| `PerfectMaskOverlay` | optional (fade only) |
| `SkinFaceMapVisualTokens` | clearer semantic accents + callout tokens |
| `AppColors` | minimal analysis semantic tokens |
| `MetricPresentationPolicy` | callout score formatting helper |
| `SkinInteractiveReportScreen` | visual separation Face Explorer ↔ report |

## REPLACE (consumer UI only)
- Dense tertiary text under face → progressive Level 2/3
- Permanent subregion chips → التفاصيل disclosure

## REMOVE FROM CONSUMER UI
- Generic forehead/L-R cheek region chips (already gone)
- Technical IDs
- Landmark polygons / outlines

## NEW (justified)
1. `perfect_mask_region_callout.dart` — no prior callout presentation owner

ACTIVE DUPLICATE RESPONSIBILITIES = 0
