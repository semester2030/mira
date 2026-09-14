# Fashion Advice — Repository Discovery

## Primary roots
| Root | Role |
|---|---|
| `mira-api/src/fashion-intelligence/` | Frozen GI / OI / SI / Wardrobe |
| `mira-api/src/vision/` | Vision platform, ontology use, FashionRule validator |
| `mira-api/src/ports/orchestrators/fashion-analysis.orchestrator.ts` | Canonical analyze orchestrator |
| `mira-api/src/ai/ai-gateway.controller.ts` | HTTP entry points |
| `mira-api/src/consultation/` | MCE LLM fashion chat |
| `mira-api/src/beauty-advisor/` | Law #33/#34 Advisor |
| `lib/features/outfit_analysis/` | Flutter client intelligence + UI |
| `assets/fashion/` | ontology, colors, compatibility, knowledge_graph, prompts |
| `docs/governance/PHASE_6B*` … `PHASE_6E3*`, `GARMENT_*`, ADR-GI/OI/SI | Freeze documentation |

## Search hits (non-exhaustive)
- Color theory: `lib/.../fashion_color_harmony_engine.dart`
- Compatibility catalog: `assets/fashion/compatibility.json`
- SKU graph: `assets/fashion/knowledge_graph.json`
- Occasion enum: `mira-api/src/ai/contracts/mira-occasion.ts`
- Ontology occasions: `assets/fashion/ontology.json`
- Nest clash heuristics: `compatibility-engine.ts` `isClashPair`
- Nest harmony: `harmony-engine.ts`
