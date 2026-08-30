# Phase 3B — Redis Dependency Map

| Consumer | Redis role | Required | Current failure | Security/cost impact | User impact |
|---|---|---|---|---|---|
| skin hourly limit | counter | CRITICAL | returns 0 | unlimited Perfect calls | request proceeds |
| legacy outfit hourly limit | counter | CRITICAL | returns 0 | abuse/provider cost | request proceeds |
| Advisor hourly limit | counter | CRITICAL | returns 0 | LLM abuse/cost | request proceeds |
| consultation hourly limit | counter | CRITICAL | returns 0 | LLM abuse/cost | request proceeds |
| MCE daily quota | counter | CRITICAL | returns 0 | free/premium cap bypass | request proceeds |
| MCE FAQ read | cache | OPTIONAL | null | extra LLM cost | cache miss |
| MCE FAQ write | cache | OPTIONAL | no-op | lower cache efficiency | no visible failure |

No Redis locks, sessions, idempotency or durable state consumers exist.
Canonical Vision analyze/recolor and segmentation are paid-provider-adjacent
and currently lack the shared hourly guard.

Missing `REDIS_URL`, connect timeout/reset, auth error, counter read/write
failure and partial INCR/EXPIRE failure all currently disable protection
silently. Health exposes no Redis state.

## Minimal remediation design

The proposed Postgres-counter alternative was rejected for Phase 3B because it
adds schema/migration/concurrency scope. The narrow safe change is:

- critical counters throw a typed unavailability error instead of returning 0;
- rate and MCE quota guards map it to a safe HTTP 503;
- optional FAQ cache remains fail-open;
- canonical FASHN/OpenAI routes receive the shared critical rate guard;
- health exposes only `configured` and
  `AVAILABLE | DEGRADED | UNAVAILABLE`, never the URL;
- no in-memory production substitute and no Redis provisioning.

Consequently production AI calls are blocked when enforcement is unavailable.
Production Redis connection proof remains Phase 3C.
