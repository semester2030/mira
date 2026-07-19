# Recommendation Contract

**Version:** `recommendation-contract-v1`

## Required fields

`id`, `category`, `titleAr`, `titleEn`, `bodyAr`, `bodyEn`, `reasonAr`, `reasonEn`, `evidence` (`metricIds`, `findingIds`, `values`), `confidence`, `priority`, `cosmeticOnly: true`, `limitations[]`

## Categories

`morning` · `night` · `weekly` · `lifestyle` · `professional_consultation` · `educational`

## Evidence rules

| Category | Evidence required |
|----------|-------------------|
| `educational` | May omit finding/metric links (platform disclaimer) |
| All others | At least one of `metricIds` or `findingIds` non-empty |

## Forbidden

- Prescribing medication as an action
- Diagnosing disease
- Recommendations for unavailable metrics without evidence
- Non-cosmetic medical claims

## Traceability

Non-educational recommendations that reference `findingIds` must point to findings present in the same report.
