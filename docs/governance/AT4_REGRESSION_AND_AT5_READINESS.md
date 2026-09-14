# AT-4 — Regression / Security / Telemetry / AT-5 Readiness

## Regression
PASS: `test:at4`, `test:at2`, `test:fk10`, `test:fk12`, `test:phase7b`
PASS: `flutter test test/advisor/` (19)
PASS: `flutter analyze` advisor + mira_features

## Security / logging
No secrets printed in AT-4 reports or test output.
Live path skipped → no provider response logging event occurred.
Public Flutter response contract unchanged (no Claim Lock / provider ids).

## Telemetry
`FASHION_KNOWLEDGE_TELEMETRY_ENABLED` not set to true.
0 FKL user telemetry activation.

## Risks
| Risk | Status |
|------|--------|
| Temptation to enable FKL on production Render | Documented forbidden |
| Missing local key blocks live proof | Current blocker |
| No staging service | Architectural gap for AT-4/AT-6 |

## Technical debt
- Provision `mira-api-qa` Render service (recommended)
- Document local QA runbook with secret injection via shell env only
- Complete live scenario matrix after key available

## AT-5 readiness
**Not ready for independent activation audit of a live QA chain.**

AT-5 should start only after:
1. Safe QA target exists (local key **or** staging service)
2. Live provider smoke PASS via `test:at4` with `AT4_LIVE_PROVIDER=1`
3. At least red/yellow/wedding + body + religion + missing occasion live traces captured
4. Production still isolated

Do not begin AT-5 until remediation above.
