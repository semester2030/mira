# Current Fashion Capability Matrix

| Capability | Status | Evidence |
|---|---|---|
| Garment category/type | IMPLEMENTED | `canonical-garment.ts`, ClassificationEngine |
| Garment colors | IMPLEMENTED | `attributes.colors[]` |
| Pattern | PARTIAL | Field optional; vision often missing |
| Material | IMPLEMENTED | often `estimated` |
| Fit | IMPLEMENTED | attributes.fit |
| Silhouette on CanonicalGarment | NOT_FOUND | silhouetteHint on vision topology only |
| Formality on garment | NOT_FOUND | ontology formality + Flutter; SI leaves unevaluated |
| Season on garment | PARTIAL | only if evidenced |
| Outfit slot compatibility | IMPLEMENTED | CompatibilityEngine |
| Color clash (API) | PARTIAL | red/pink, orange/red, green/red only — **not red/yellow** |
| Color wheel theory (API) | NOT_FOUND | — |
| Color wheel theory (Flutter) | IMPLEMENTED | FashionColorHarmonyEngine |
| Occasion input | IMPLEMENTED | MiraOccasion + body.occasionId |
| Occasion suitability metric | IMPLEMENTED | ContextEngine + occasionFit (OI service) |
| OI on HTTP analyze | NOT_FOUND / unwired | gateway returns garments only |
| Accessory/shoe/bag/jewelry scoring (OI) | PARTIAL | slots + entityClass only |
| Styling principle KB | NOT_FOUND | ReasoningEngine evidence-only |
| Style goals/memory/decisions | IMPLEMENTED | CanonicalStylingProfile |
| Catalog SKU compatibility | IMPLEMENTED (Flutter/assets) | compatibility.json |
| Curated Fashion Knowledge Base w/ provenance | NOT_FOUND | knowledge_graph is SKU edges, no source citations |
| Beauty Advisor invent-free | IMPLEMENTED | grounded-response-engine |
| MCE invent-free fashion advice | NOT_FOUND | soft prompt only |
