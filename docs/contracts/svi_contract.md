# SVI Contract (v2)

**Version:** `svi-contract-v1`  
**Calculation version:** `svi-v2`  
**Formula id:** `svi-v2-dynamic-denom`

## Rules

1. Dynamic denominator — only available metrics contribute weight.
2. Unavailable metrics are listed in `unavailableExcluded` and never filled.
3. Store `positiveContributors` and `negativeContributors`.
4. Attach `confidence`, `version`, `formulaId`.
5. Provide `explanationAr` / `explanationEn`.
6. Must never claim beauty ranking, medical health, or clinical diagnosis.

## Regression (Phase 3)

Phase 3.5 must not change the formula unless a verified defect is found. Snapshot/golden tests lock current outputs for representative cases.
