# Test Quality

| Layer | Classification |
|---|---|
| face-intelligence-projector adversarial | UNIT |
| sanitize+project 9N ad-hoc | UNIT / SERVICE-SIM |
| phase7b | UNIT/SERVICE schema |
| Flutter Face suite | UNIT + WIDGET + GOLDEN |
| AdvisorService Prisma IDOR | CODE REVIEW only — not HTTP E2E |
| Nest HTTP + real DB | NOT IN CI |

Production realism: **direct projector + service code path**. Not full Nest HTTP E2E.
