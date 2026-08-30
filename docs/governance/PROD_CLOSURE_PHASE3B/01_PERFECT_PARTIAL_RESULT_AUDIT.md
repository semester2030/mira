# Phase 3B — Perfect Corp Partial Result Audit

Baseline: `584be7fcd9486b17ba97569debe8b9aacf90408a`.

Trace: Flutter skin upload → `/ai/skin-analysis` → quality/face gates →
`SkinAnalysisOrchestrator` → `PerfectCorpSkinAdapter` →
`PerfectCorpSkinProvider` → `PerfectCorpService` upload/task/poll →
`mapYouCamResults` → port metrics → Skin Intelligence → Prisma → Flutter.

The Phase 3 finding is confirmed. HTTP/provider failures fail closed, but a
provider task with status `success` and incomplete `results.output` is converted
to normal numeric output before the honest port availability contract sees it.

| Provider field | Canonical field | Requested/required | Current missing behavior | Synthetic | Confidence/UI/storage |
|---|---|---|---|---|---|
| `moisture.ui_score` | hydration | requested; required by numeric legacy contract | 60 | YES | 70/visible/persisted |
| `oiliness.ui_score` | oiliness | requested/required | 40 | YES | 70/visible/persisted |
| `pore.ui_score` | pores | requested/required | 70 then severity | YES | 70/visible/persisted |
| `wrinkle.ui_score` | wrinkles | requested/required | 70 then severity | YES | 70/visible/persisted |
| `acne.ui_score` | acne | requested/required | 75 then severity | YES | 70/visible/persisted |
| `age_spot.ui_score` | pigmentation | requested/required | 80 then severity | YES | 70/visible/persisted |
| `redness.ui_score` | redness | requested/required | 85 then severity | YES | 70/visible/persisted |
| `texture.ui_score` | texture | requested/required | 72 | YES | 70/visible/persisted |
| `radiance.ui_score` | radiance | optional/not requested | unavailable | NO | hidden if unavailable |
| `firmness.ui_score` | firmness | optional/not requested | unavailable | NO | hidden if unavailable |
| `dark_circle*.ui_score` | dark circles | optional/not requested | unavailable | NO | hidden if unavailable |
| derived average | legacy beauty score | derived | 72 if no values | YES | can influence legacy surfaces |
| moisture + oiliness | skin type | derived | inferred from defaults | YES | visible/persisted |
| concern scores/raw labels | undertone | derived | inference may run on defaults | YES | visible/persisted |
| concern scores | skin age | derived | 30/formula | YES | visible/persisted |

`null`, wrong type and `raw_score`-only rows are discarded and therefore enter
the same fallback path. `mapLegacySkinToMetrics` and the canonical Skin mapper
already support `available:false`, but `SkinAnalysisResult` requires the eight
legacy fields numerically. Changing that frozen cross-layer contract would be
larger and risk Skin/Face semantics.

## Minimal remediation design

For the eight requested metrics, require finite `ui_score` values in `[0,100]`.
If one or more is absent/invalid, reject the provider result as incomplete.
Remove all score/backfill/empty-average defaults. Preserve valid provider
values and existing downstream intelligence unchanged. This selects policy D
(fail the analysis) because the current legacy result contract cannot honestly
represent partial scalars.

No real provider call is required to verify this mapper policy.
