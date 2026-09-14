# AT-4R — Regression / Risks / Debt

## Regression this run
PASS: `test:at4` (live skipped), `test:at2`, `test:fk12`, Flutter `test/advisor/`

## Risks
| Risk | Mitigation |
|------|------------|
| Developer enables FKL on production Render | Explicit forbid; scripts local-only |
| Empty `.env.qa` committed | gitignored; only `.example` committed |
| AUTH_SKIP left on in shared env | Documented local-only |
| Flutter still hits production URL by default | Must pass `MIRA_API_BASE_URL` |

## Technical debt
- Optional Nest HTTP live smoke script with AUTH_SKIP (after key)
- Optional dedicated `mira-api-qa` Render service before production activation
- Flutter widget E2E against local Dio (manual acceptable for AT-4R)
