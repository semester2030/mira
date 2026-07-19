# Face Findings Contract

**Version:** `face-findings-contract-v1`  
**Phase:** 4C  
**Related:** `face-shape-v1` / `face-shape-hybrid-ratios-v1`

## Scope

Explainable **cosmetic** face findings derived from available Face Intelligence metrics only:

- Face shape class findings  
- Proportion notes (elongation, lower/upper width)  
- Cautious symmetry notes  

Sibling to Skin findings — **no shared engines**, no skin type / undertone coupling.

## Rules

1. Findings require evidence from **available** metrics (never invent).  
2. Language is cosmetic / styling — not medical diagnosis.  
3. No attractiveness / beauty ranking.  
4. `recommendationEligible` may be true for shape/proportion; false for cautious symmetry notes.  
5. Empty findings when shape unavailable and no eligible geometry notes.

## Face shape taxonomy

`oval` · `round` · `square` · `heart` · `oblong` · `diamond` · `triangle`

Hybrid inputs: cheek width/height, forehead span / cheek, jaw span / cheek (jaw indices owned by `MediapipeLandmarkIndices`).

## Forbidden

- Medical craniofacial claims  
- Merging into FaceHealthMap / SVI  
- Perfect Corp as source  
- Recommendations product lock-in (Phase 4D)
