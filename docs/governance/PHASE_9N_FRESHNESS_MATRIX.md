# Freshness Matrix

| Behavior | Status |
|---|---|
| `evidenceStale: true` propagates to unit freshness | PASS |
| Envelope/planner blocks stale grounded narration when stale=true | PASS (phase7b) |
| Server independently marks Face report stale by age | **NOT PRESENT** |
| Client can omit/under-report evidenceStale | **MINOR residual** (pre-9M design; not claim forgery) |

Not classified as reopen of MAJOR-9L-01.
