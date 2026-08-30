# Fashion Heuristic Audit

| Item | Domain knowledge? | Engineering heuristic? | Evidence |
|---|---|---|---|
| isClashPair red/pink, orange/red, green/red | Weak domain (limited) | YES — arbitrary short list | compatibility-engine.ts |
| colorSupport = 0.55 + shared*0.1 + … | NO | YES — magic constants | harmony-engine.ts |
| Flutter hue bell curves (σ≈15–25°) | Inspired by color theory | YES — engineered scoring | fashion_color_harmony_engine.dart |
| knowledge_graph weights 0.78–0.96 | Curated taste | YES — manual weights | knowledge_graph.json |
| Ontology wedding formality 0.95 | Partial domain encoding | Scalar heuristic | ontology.json |
| STYLING_DECISION_PRIORITY_BAND | Process priority | YES — claim-band ranking | reasoning-engine.ts |

**Do not treat Flutter color-wheel scores as cited fashion knowledge** without provenance.
