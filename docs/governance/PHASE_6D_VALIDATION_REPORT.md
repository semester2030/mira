# Phase 6D / 6D.2 — Validation Report

## Validators (`outfit-validators.ts`)

| Check | Full outfit | Capability graph |
|-------|-------------|------------------|
| Duplicate garments / broken slots | Yes | N/A |
| Metrics / confidence without evidence | Yes | N/A |
| Uncited evidence | Yes | N/A (no metrics) |
| Dishonest completeness | Yes | N/A |
| Runtime FAILED ≠ complete reason | Yes | N/A |
| Graph empty / duplicate ids | Yes | Yes (`validateEvidenceGraphIntegrity`) |
| Missing / broken / unconnected edges | Yes | Yes |
| Provider leakage | Yes | Yes |

## Assertions

- `assertValidOutfit` — `analyzeOutfit`, `compareLooks`
- `assertValidEvidenceGraph` — compatibility, color_harmony, occasion_matching, season_matching (6D.2)

## Tests

`phase6d-outfit-intelligence.schema-tests.ts` · `npm run test:phase6d`
