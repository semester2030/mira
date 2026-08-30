# AT-4R — Staging Decision

## Decision now
**LOCAL_SUFFICIENT_FOR_AT4** (architecture + scripts ready).

Live proof still blocked only by missing local `LLM_API_KEY`, not by missing staging.

## Before production activation / AT-5+
**DEDICATED_STAGING_REQUIRED_BEFORE_AT5** may still apply for:
- HTTPS / Render networking
- Auth parity without AUTH_SKIP
- Deployment config parity

## Design only (not deployed)
| Item | Spec |
|------|------|
| Service name | `mira-api-qa` (separate from `mira-api`) |
| Secrets | Own `LLM_API_KEY`; never clone blindly |
| Flags | FKL integration/LLM true; telemetry false; legacy MCE false |
| DB | Prefer non-production DB |
| Kill switch | Flip FKL flags false on QA service |

Do **not** silently provision Render infrastructure without explicit user authorization.
