# AT-4 — Scenario E2E Status Pack

All **live** Flutter→OpenAI scenarios are **BLOCKED** pending remediation (see AT4_EXECUTIVE_SUMMARY).

| Scenario | Status |
|----------|--------|
| Red/yellow/wedding live | BLOCKED (no key/staging) |
| Bold preference live | BLOCKED |
| Shoes/bags live | BLOCKED |
| Missing occasion live | BLOCKED |
| Silhouette live | BLOCKED |
| Cultural explicit live | BLOCKED |
| Arabic≠culture live | BLOCKED |
| Body safety live | BLOCKED |
| Religion live | BLOCKED |
| False provenance live | BLOCKED |
| Prompt injection live | BLOCKED |
| Provider failure (mocked adapter) | **PASS** fail-closed |
| Flags-off rollback | **PASS** |
| MCE Option A | **PASS** quarantine |
| Non-fashion MCE regression | Covered by prior fk12/phase7b; no AT-4 prod change |
| Double-path client | Covered by AT-3 tests (still green) |
| Telemetry | **PASS** remains OFF |
| Production isolation | **PASS** render untouched |

AT-2 mocked red/yellow/wedding + Claim Lock path remains green as regression evidence of pipeline correctness without live provider.
