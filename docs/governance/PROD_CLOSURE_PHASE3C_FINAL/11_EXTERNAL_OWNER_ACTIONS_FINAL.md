# Phase 3C Final — External Owner Actions

No owner action requires sending a secret to Cursor.

| # | Service | Classification | Exact action | Evidence that closes it | Billing | Secret | Cursor can continue independently |
|---:|---|---|---|---|---|---|---|
| 1 | Render | CLOSED | authenticated CLI/API exposed service and redacted env presence | service/config matrix verified | NO | NO | YES |
| 2 | Perfect Corp | CLOSED | Render completed upload→task→poll→adapter map | canonical result returned; no mock | NO new purchase | NO | YES |
| 3 | FASHN | CLOSED | real canonical transaction completed | response/schema/map PASS | EXISTING | NO | YES |
| 4 | LLM | CODE REMEDIATION REQUIRED | replace JSON mode with strict provider schema; preserve validator and Claim Lock | conforming live draft reaches Claim Lock | EXISTING | NO | separate remediation task required |
| 5 | Firebase Auth | CLOSED | controlled valid identity accepted; invalid/missing rejected; identity deleted | completed | NO | NO | YES |
| 6 | Firebase Storage | OPTIONAL / DEFERRED | do not enable Blaze for avatar | n/a — not a 3C gate | NO | NO | YES |
| 7 | Redis/Valkey | CLOSED | free `mira-redis` created, wired and verified | TLS/AUTH/PING/write/read/TTL/delete PASS | NO NEW PAID PLAN | YES — managed internally | YES |
| 8 | BlazeFace | CLOSED / PHASE4_ONLY | use approved startup-preload strategy; run Render cold-start proof in Phase 4 | candidate preload, inference and health pass | NO | NO | YES |
| 9 | PostgreSQL operations | PHASE4_ONLY | inspect candidate schema/SSL/pooling; backup ownership is Phase 6 | deployment acceptance evidence | POSSIBLE | NO | YES |

Launch-critical owner decisions before Phase 4: `0`.
Launch-critical technical closure remaining: LLM strict-schema remediation and
positive Claim Lock acceptance.
