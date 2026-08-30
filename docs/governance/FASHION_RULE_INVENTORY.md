# Fashion Rule Inventory

| Rule / claim | File | Inputs | Outputs | Deterministic | Explainable | Provenance | Tests |
|---|---|---|---|---|---|---|---|
| multiple_full_body hard conflict | compatibility-engine.ts | slots | hardConflicts + evidence | YES | claim string | sourceRefs slot_rules | phase6d |
| full_body_with_separates | same | slots | hardConflicts | YES | YES | slot_rules | phase6d |
| soft color_clash stems | same | colors | softConflicts | YES | claim soft:color_clash | garment colors | phase6d |
| color_palette_size harmony | harmony-engine.ts | colors | colorSupport | YES | claim | garment colors | phase6d |
| style_hint_overlap | harmony-engine.ts | styleHints | styleSupport | YES | claim | styleHints | phase6d |
| mapOccasion wedding→wedding | context-engine.ts | occasionId | context.occasion | YES | mapped id | mapping fn | phase6d |
| FashionValidator dominant color / topology / accessory / layering / archetype | fashion-validator.service.ts | vision doc | validation result | YES | rule codes | engineering | vision-pipeline.schema-tests |
| Catalog works_with edges | knowledge_graph.json | SKU ids | edges+whyAr | YES | whyAr | **no formal source** | Flutter tests |
| Catalog compatibleIds | compatibility.json | anchorId | list+whyAr | YES | whyAr | **no formal source** | Flutter tests |
| Hue-bell complementary/analogous/… | fashion_color_harmony_engine.dart | FashionColorEntry | score/type | YES | labelAr | **algorithm heuristic, not cited theory** | fashion_* tests |

### Missing as structured rules
IF wedding AND high-contrast warm pair THEN prefer calmer alternative — **NOT_FOUND** as rule object.
