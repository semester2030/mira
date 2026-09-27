# Phase 3B Final — Clean Adversarial Verification

Source: `4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`

| Case | Required behavior | Result |
|---|---|---|
| Perfect incomplete/invalid result | explicit failure; no synthetic score | PASS (14 classes) |
| FASHN/legacy Fashion failure in production | no mock/deterministic success | PASS |
| Redis absent/failed/partial counter | protected calls fail closed | PASS |
| BlazeFace offline/corrupt/hanging model | startup/request explicit failure | PASS |
| Avatar unauthorized/invalid upload | rules denial | PASS |

- `SYNTHETIC_SCORE_FROM_MISSING_PROVIDER_DATA = 0`
- `SYNTHETIC_PRODUCTION_SUCCESS = 0`
- `NO_UNBOUNDED_AI_ACCESS_ON_REDIS_FAILURE = true`
- fake BlazeFace successful detection on model failure: `0`

All provider cases used local doubles. Real Perfect Corp, FASHN and OpenAI E2E
was not performed.

`PASS`
