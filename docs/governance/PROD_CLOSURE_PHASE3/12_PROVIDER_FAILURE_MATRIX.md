# Phase 3 — Provider Failure Matrix

| Dependency / condition | User-visible behavior | Internal handling | Closed/open | False-success risk |
|---|---|---|---|---|
| Perfect key missing | 503/config error | rejected | CLOSED | no mock |
| Perfect 401/403 | analysis failure | HTTP error | CLOSED | none |
| Perfect 429 | provider failure | generic upstream error | CLOSED | no tailored retry/backoff |
| Perfect 5xx/timeout | analysis failure | bounded polling/request path | CLOSED | none |
| Perfect malformed/partial success | result may contain default metrics | mapper fills fixed scores | **OPEN TRUTH GAP** | YES |
| FASHN key/base missing | fashion fails | explicit not configured | CLOSED | canonical none |
| FASHN 401/429/5xx/timeout | fashion/recolor fails | explicit error/poll timeout | CLOSED | canonical none |
| FASHN malformed/empty output | fashion fails | schema/output gates | CLOSED | canonical none |
| OpenAI missing/401 | vision/MCE/FK blocked | explicit error | CLOSED | legacy/MCE fallbacks exist |
| OpenAI 429/5xx/timeout | provider feature fails | bounded retry only in FK | CLOSED canonical | legacy OI deterministic fallback |
| OpenAI malformed response | vision/FK rejects | schema/Claim Lock | CLOSED canonical | MCE `parse_fallback` prose |
| Firebase missing/invalid token | 401 | Auth guard | CLOSED | none |
| Firebase Admin misconfig | authenticated APIs unavailable | runtime config error | CLOSED | health may still be green |
| Firestore/Storage unavailable | profiles/avatar fail or degrade | Flutter catches/logs some failures | PARTIAL OPEN | stale/blank profile |
| Postgres unavailable | start or request fails | Prisma/migration error | CLOSED | none |
| Redis absent/unavailable | request proceeds | count=0/cache miss | **OPEN** | limits silently absent |
| TFHub model unavailable | first image gate fails/hangs | detector load error, no app deadline | CLOSED but poor availability | health remains green |
| Render API unavailable | app/API fails | network errors | CLOSED | none |
| notification channel absent | no reminders/push | local notification only | OPEN UX | no delivery claim should be made |

Canonical Skin/Fashion synthetic mock providers are blocked in production, but
the Perfect partial mapper and legacy hybrid outfit endpoint prevent a blanket
“no fake AI success anywhere” claim.
