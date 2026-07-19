# Face Recommendation Contract

**Version:** `face-recommendation-contract-v1`  
**Phase:** 4D  
**Engine:** `face-styling-reco-v1` / `face-reco-v1`

## Scope

Evidence-backed **cosmetic styling** recommendations derived from Face Intelligence findings (shape · proportion).  
Sibling to Skin recommendations — **no shared engines**, no Perfect product lock-in.

## Required fields

`id`, `category`, `titleAr`, `titleEn`, `bodyAr`, `bodyEn`, `reasonAr`, `reasonEn`,  
`evidence` (`metricIds`, `findingIds`, `values`), `confidence`, `priority`,  
`cosmeticOnly: true`, `productLockIn: false`, `limitations[]`

## Categories

`hairstyle` · `makeup_contour` · `eyewear` · `accessories` · `educational`

## Evidence rules

| Category | Evidence required |
|----------|-------------------|
| `educational` (platform disclaimer) | May omit finding/metric links |
| All others | At least one of `metricIds` or `findingIds` non-empty; findingIds must exist in the same run |

## Forbidden

- Recommendation without evidence (except platform educational disclaimer)  
- Perfect Corp / marketplace SKU lock-in  
- Attractiveness / beauty ranking  
- Medical diagnosis or medication  
- Importing skin-intelligence recommendation engine  
- Report UI (Phase 4E)

## Traceability

Non-disclaimer recommendations that reference `findingIds` must point to findings present in the same pipeline result.
