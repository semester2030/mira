# FK-11 — Findings Register

| ID | Sev | Title | Evidence |
|----|-----|-------|----------|
| F-01 | MAJOR | Bridge not on production HTTP path | `advisor.service.ts` uses `projectNoKnowledge` only; bridge callers = fk10 tests |
| F-02 | MAJOR | Default MCE fashion bypass | `evaluateMceFashionQuarantine` no-ops when flag false |
| F-03 | MAJOR | Flag ON does not deliver Mode B | Unavailable reason `ADVISOR_CHAT_REQUIRES_FASHION_BRIDGE_CONTEXT` |
| F-04 | MAJOR | DTO lacks fashion context | `advisor-chat.dto.ts` message+analysisId only |
| F-05 | MAJOR | Docs overstated FK-10 wiring | FK10 readiness vs code |
| F-06 | MAJOR | outfit-intelligence BYPASS_RISK | `/ai/outfit-intelligence` no Claim Lock |
| F-07 | MAJOR | Soft export boundaries | fixtures ACTIVE, mock LLM, saveDraftRegistry via barrels |
| F-08 | CRITICAL* | Telemetry without consent if enabled | `DOCUMENTED_GAP`; no runtime consent check (*conditional on enablement) |
| F-09 | MINOR | G8 vacuous on Mode B | empty knowledgeRuleIds |
| F-10 | MINOR | Law #34 is key-based | validates citations/keys; grounded engine supplies statementAr |
| F-11 | INFO | ACTIVE=0 honest | registry.json rules=[] |
| F-12 | INFO | No auto-promotion | Law #39 + guards |
| F-13 | INFO | Regressions green | independent re-run |
