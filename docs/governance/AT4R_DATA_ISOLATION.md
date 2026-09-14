# AT-4R — Data Isolation

## Policy
QA must not pollute production user data.

## Local path
- Use local `DATABASE_URL` (developer DB)
- `AUTH_SKIP` → `dev-user` sessions only
- Telemetry FKL off → no FKL analytics events
- Do not enable FKL flags against production Render DB

## Writes to audit when Nest live smoke runs
- consultation sessions (if Advisor persists)
- Firebase (only if real Firebase auth used)
- memory / analytics sinks

Use test users where Firebase is involved.
