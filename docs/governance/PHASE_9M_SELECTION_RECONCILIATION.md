# Selection Reconciliation

| contextType | Refs | Server resolution |
|---|---|---|
| insight/detail | selectedInsightId / selectedDetailRef | finding / metric / shape by id prefixes |
| primaryResult | selectedResultId / detail_shape_* | shape statement |
| guidance | frozenRecommendationRef | recommendation + stored reasonAr |
| region | selectedRegion | illustrative policy unit only (+ optional related finding) |
| unknown refs | — | base report units; no client text fallback |
