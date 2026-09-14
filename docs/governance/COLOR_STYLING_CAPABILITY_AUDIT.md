# Color Styling Capability Audit

| Concept | API OI | Flutter | Status |
|---|---|---|---|
| Complementary / analogous / triadic / … | NOT_FOUND | IMPLEMENTED | FashionColorHarmonyEngine |
| Warm/cool | NOT_FOUND / PARTIAL | PARTIAL via library metadata if present | check colors.json |
| Contrast / saturation / value | PARTIAL (palette size) | PARTIAL (hue/mono scores) | — |
| Neutral / metallics as rules | NOT_FOUND as rules | catalog edges only | knowledge_graph |
| Seasonal palettes | PARTIAL ontology season | PARTIAL | — |
| Skin-tone matching | PARTIAL professional-color-matcher / skin link UI | PARTIAL | separate from OI |
| Red+yellow relationship | NOT clash on API list | CAN score as high-contrast / not complementary-180 | evidence |

**Execution path for API color:** garment colors → CompatibilityEngine stem clash OR HarmonyEngine palette size — **not** color-wheel theory.
