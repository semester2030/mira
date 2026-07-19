# Skin Intelligence Architecture (Phase 3)

## Purpose

Transform Mira from “showing provider outputs” into a **provider-independent, explainable, cosmetic skin intelligence system**.

## Pipeline

```
Perfect Corp (or other adapter)
        ↓
SkinAnalysisPort (SkinMetric[])
        ↓
Provider Adapter → Canonical Skin Model
        ↓
Skin Finding Engine
        ↓
Skin Vitality Index v2
        ↓
Explanation Engine
        ↓
Recommendation Engine
        ↓
Progress Engine
        ↓
Report Engine → SkinIntelligenceReportDto
        ↓
MiraBeautyReport.skinIntelligence → Flutter UI
```

## Non-negotiable rules

- Never invent skin findings or fabricate scores.
- Never average missing provider values.
- Unavailable metrics stay **unavailable** (not 0 / neutral / guessed).
- Every displayed metric carries: source, confidence, provider, limitations, version.

## Canonical model

- Version: `skin-model-v1`
- Metrics: hydration, radiance, texture, pores, acne, wrinkles, fineLines, pigmentation, redness, darkCircles, oiliness, firmness, elasticity, sensitivity, toneUniformity, undertone
- Overall vitality is **SVI v2**, not a fabricated catalog metric.

## Code map

| Concern | Path |
|--------|------|
| Canonical model | `mira-api/src/intelligence/skin-intelligence/canonical-skin.model.ts` |
| Provider mapping | `provider-skin.mapper.ts` |
| Findings | `skin-finding.engine.ts` |
| SVI v2 | `svi-v2.engine.ts` |
| Explanations | `explanation.engine.ts` |
| Recommendations | `recommendation.engine.ts` |
| Progress | `progress.engine.ts` |
| Report DTO | `report.engine.ts` |
| Pipeline | `index.ts` (`runSkinIntelligencePipeline`) |

## UI

Flutter consumes `miraReport.skinIntelligence` only — never raw YouCam/Perfect JSON.

## Regression

- Phase 0 / 1 / 2 / 2.1 capture & ports remain unchanged in behavior.
- Storage field `overallBeautyScore` retained; calculation version is `svi-v2`.
