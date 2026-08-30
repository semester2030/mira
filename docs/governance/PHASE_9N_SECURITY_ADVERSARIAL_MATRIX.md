# Security Adversarial Matrix (independent execution)

| # | Attack | Result |
|---|---|---|
| 1 | forged publicFactAr | PASS — not sealed |
| 2 | forged reasonAr | PASS |
| 3 | attractiveness injection | PASS |
| 4 | medical injection | PASS |
| 5 | provenance injection | PASS |
| 6 | unknown analysis (no row) | PASS code-path empty |
| 7 | cross-user | PASS code ownership; no live HTTP |
| 8–10 | unknown insight/detail/guidance | PASS |
| 11 | cross-analysis reco ref | PASS — absent from report A |
| 12 | stale flag | PASS when set |
| 13 | low confidence | PASS — no strengthening via forge |
| 14 | region escalation | PASS |
| 15 | old client payload | PASS — ignored |
| 16–17 | follow-up/switch | PASS at projector (same/different resolved ids) |
| 18 | no report fields + forged text | PASS — no client prose |

Also: MaxLength 600/400 on free text — OBSERVATION (ignored but still parsed).
