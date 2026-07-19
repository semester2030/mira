# Skin Intelligence Platform Contract

**Version:** `skin-intel-contract-v1`  
**Phase:** 3.5  
**Status:** Binding — no implementation may violate this contract.

## Purpose

Permanent contract for Mira Skin Intelligence. Future phases (including Face Intelligence) must preserve these semantics.

## Pipeline (mandatory order)

```
Provider Adapter
  → Canonical Skin Model
  → Skin Findings
  → SVI v2
  → Recommendations
  → Progress
  → Premium Report DTO
  → Flutter UI (consumes DTO only)
```

No stage may invent values. Information loss must fail validation (never silently repaired).

## Canonical metric IDs

`hydration` · `radiance` · `texture` · `pores` · `acne` · `wrinkles` · `fineLines` · `pigmentation` · `redness` · `darkCircles` · `oiliness` · `firmness` · `elasticity` · `sensitivity` · `toneUniformity` · `undertone`

Overall vitality is **SVI**, not a catalog metric.

## Unavailable semantics

| Rule | Required behavior |
|------|-------------------|
| Missing provider value | `availability: unavailable` |
| Forbidden fillers | `0`, average, neutral, guessed |
| Confidence when unavailable | `0` |
| Recommendation eligibility | `false` |
| SVI | Metric excluded from denominator |

## Confidence semantics

- Numeric `0–100` on metrics / SVI / recommendations.
- Band labels: `high` (≥80), `medium` (≥55), `low` (>0), `unavailable` (≤0).
- Mock results: confidence level `unavailable` for display gates in production.

## Provenance semantics

Every available metric / report must expose:

- `source` (e.g. `provider_measured`, `mock`, `unavailable`)
- `provider` (+ optional `providerVersion`)
- `limitations[]`
- Version fields on the report (`skinVersion`, `formulaVersion`, `captureVersion`, `qualityVersion`, `intelligenceVersion`, `reportVersion`)

## Finding structure

Required fields (semantic):

| Field | Binding |
|-------|---------|
| Reason | `evidenceAr` / `evidenceEn` |
| Evidence | same |
| Confidence | `confidence` band |
| Source | `source` |
| Limitations | `limitations[]` |
| Recommendation eligibility | `recommendationEligible` |
| Priority | `priority` |
| Version | inherited from report `intelligenceVersion` + finding engine id `finding-v1` |

Findings must not be created for unavailable metrics.

## Recommendation structure

See `recommendation_contract.md`. Educational disclaimer may omit finding links; all other categories require metric and/or finding evidence.

## Progress structure

See `progress_contract.md`.

## SVI structure

See `svi_contract.md`.

## DTO schema

See `skin_report_contract.md`. Public DTO must not contain provider raw JSON (`rawYouCam`, task payloads, secrets).

## Localization

- Every user-facing string pair: Arabic + English.
- Professional cosmetic language only.
- No medical diagnosis / medication prescription claims as advice.
- Terminology must stay consistent across stages (same metric id → same display names).

## Versioning policy

| Artifact | Current id |
|----------|------------|
| Skin model | `skin-model-v1` |
| Intelligence | `skin-intel-v1` |
| Report | `skin-report-v1` |
| SVI | `svi-v2` |
| Formula | `svi-v2-dynamic-denom` |
| Progress | `progress-v1` |
| Explain | `explain-v1` |
| Finding engine | `finding-v1` |
| This contract | `skin-intel-contract-v1` |

Breaking changes require a new version id + migration notes. Additive optional fields are allowed if old clients ignore them.

## Backward compatibility

- Historical `miraReport` without `skinIntelligence`: readable; UI omits section.
- Field `overallBeautyScore` retained as SVI numeric storage key.
- Old `calculationVersion: svi-v1` fixtures remain valid historical labels.
- New analyses emit `svi-v2`.

## Provider independence

Only adapters under `mira-api/src/ports/adapters/` may know Perfect Corp / YouCam schemas.  
Forbidden direct dependencies on provider schemas:

- Flutter screens
- Report engine
- Recommendation engine
- Progress engine
- SVI engine
- Public DTO
- Localization copy tables in UI

## Violation handling

Contract validators **fail loudly**. No silent repair of missing evidence, missing translations, fabricated metrics, or provider leakage.
