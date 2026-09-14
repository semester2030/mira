# FK-11 — Advisor Integration Audit (FK-10)

## Claimed
Full Claim Lock → Envelope integration ready.

## Verified
| Component | Exists | Production-wired |
|-----------|--------|------------------|
| Projection contract | YES | via unavailable stub only |
| Eligibility mapping | YES | stub uses UNAVAILABLE |
| Bridge | YES | **NO** (tests only) |
| Evidence projector | YES | YES (for stub units) |
| MCE quarantine | YES | when flag ON |
| Mode B on /advisor/chat | — | **NO** |

## Law #34 on Advisor path
Grounded engine speaks envelope `statementAr` only; validator checks cited keys ⊆ envelope.  
When flag ON, unavailable statement is envelope-grounded — correct for stub, not Mode B delivery.

## Law #33
Advisor does not compute fashion independently on `/advisor/chat`. Ownership OK. Missing: delivery of FK advice.
