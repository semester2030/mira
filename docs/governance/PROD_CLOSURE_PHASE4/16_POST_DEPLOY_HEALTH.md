# Post-Deploy Health

## RUNTIME / PRODUCTION evidence

| Check | Result |
|---|---|
| canonical `/api/v1/health` | 200 / PASS |
| root `/health` | 404; expected API-prefix behavior |
| `/api/v1/website/features` | 200 / PASS |
| `/api/v1/website/stats` | 200 / PASS |
| PostgreSQL read-only `SELECT 1` | PASS |
| Redis PING from new runtime | PASS |
| Nest startup | PASS |
| repeated startup crash / boot loop | none |

Post-deploy Redis job: `job-daafpc2jnfac738djc5g`.

The health object reports Redis configured and fail-closed for critical
controls. Its initial `DEGRADED` state reflects the health-controller
RedisService's lazy, unused client; the direct PING from the deployed runtime
proved connectivity.

Stabilization checks remained 200. No rollback condition was met.
