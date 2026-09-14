# Fashion Knowledge Source Audit

## DOES MIRA CURRENTLY HAVE A FASHION KNOWLEDGE BASE?
**PARTIAL**

| Source | Class | Location | Provenance? | Production use |
|---|---|---|---|---|
| Ontology taxonomy | Internal taxonomy | `assets/fashion/ontology.json` | version:1 only | Vision/catalog/Flutter |
| Color library | Static lookup | `assets/fashion/colors.json` + Flutter library | weak | Flutter harmony / matching |
| Compatibility pairs | Static lookup / curated content | `assets/fashion/compatibility.json` | whyAr text, no source id | Flutter FashionCompatibilityEngine |
| Knowledge graph edges | Curated SKU graph | `assets/fashion/knowledge_graph.json` | whyAr; **no** research/stylist id | Flutter FashionKnowledgeGraph |
| Nest CompatibilityEngine clashes | Hardcoded heuristic | `compatibility-engine.ts` | sourceRefs engine ids | OI engines/tests |
| Nest HarmonyEngine | Deterministic heuristic | `harmony-engine.ts` | evidence graph claims | OI engines/tests |
| FashionValidatorService rules | Hardcoded rule | vision FashionValidatorService | engineering | Vision pipeline tests |
| MCE LLM | LLM general knowledge | consultation prompts | none for invented text | Outfit Ask Mira |
| Legacy LlmOutfitReasoningService | LLM | `llm-outfit-reasoning.service.ts` | weak | hybrid endpoint |
| StylingReasoningEngine | Evidence interpreter | `reasoning-engine.ts` | Law #32 evidence refs | SI tests; no HTTP wire on analyze |
| Beauty Advisor claims | Evidence-grounded | envelope + grounded engine | subsystem provenance | `/advisor/chat` |

### Answer detail
Mira has **catalog/SKU knowledge** and **engineering heuristics**, not a versioned, citable **Fashion Knowledge Base** of principles (color theory provenance, dress-code rules with approval, cultural sources).
