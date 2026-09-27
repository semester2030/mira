# Startup Log Review

## DEPLOYMENT / RUNTIME evidence

Reviewed logs from 2026-08-31T03:59:00Z after the controlled deploy.

Observed:

- Prisma schema loaded and Client generated
- seven existing migrations discovered
- no migration error
- production-integrity emitted one non-fatal legacy outfit warning
- Prisma and Redis modules initialized
- BlazeFace startup preload succeeded
- Nest application successfully started
- Render deploy became live
- error-level log query returned no records
- boot-loop/OOM/port-failure signature count: `0`
- secret-pattern match count: `0`

No PostgreSQL, Redis, Firebase Admin, Perfect, FASHN, LLM, OOM, port-binding,
or uncaught startup fatal was observed.

`STARTUP_LOGS = PASS`; `SECRET_EXPOSURE_INCIDENT = NO`.
