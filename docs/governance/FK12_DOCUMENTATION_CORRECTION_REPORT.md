# FK-12 — Documentation Correction

## Historical truth (preserve)
- FK-10 self-reported Advisor integration ready for FK-11 audit.
- FK-11 independent audit verdict **C** — production wiring was **not** ready.
- Do **not** rewrite FK-11 to say wiring was ready.

## Correction
| Claim (pre-FK-12) | Actual | After FK-12 |
|-------------------|--------|-------------|
| Production /advisor/chat uses Fashion Knowledge bridge | Library/tests only; HTTP used projectNoKnowledge stub | Bridge invoked from AdvisorService.chat |
| Integration OFF safe by default | MCE could still prescribe | Option A global quarantine |
| Telemetry gated by flag alone | Consent gap if flag forced | Consent hard gate |

## Portals / prior FK-10 docs
Treat FK-10 “production wiring ready” language as **historical self-report**, superseded by FK-11 C then remediated by FK-12.
