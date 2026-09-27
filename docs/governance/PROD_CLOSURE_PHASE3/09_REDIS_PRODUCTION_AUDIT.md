# Phase 3 — Redis / Valkey Audit

`RedisService` lazily creates an `ioredis` client only when `REDIS_URL` is
present. Consumers are hourly skin/outfit/advisor limits, MCE daily quota and
FAQ cache.

## Infrastructure

- `REDIS_URL` is documented locally but absent from `render.yaml`;
- no Render Key Value resource is declared;
- Render account inspection remained unauthorized;
- TLS mode, credential, retry and production instance are UNKNOWN.

## Failure behavior

Missing/unreachable Redis returns counter `0` and cache miss. Consequently
rate limits and MCE daily quota are silently skipped. `maxRetriesPerRequest=1`
and lazy connect avoid process failure but make enforcement fail open.

## Classification

Cache is OPTIONAL. Abuse/cost limits are `REQUIRED_FOR_SECURE_LAUNCH`.

Owner must either provision a secure Render Key Value/external Redis and set
`REDIS_URL` directly in the Dashboard, then prove 429/quota behavior, or
explicitly accept/document fail-open launch risk. Do not paste the URL into
chat or source.

## Verdict

`BLOCKED — PRODUCTION_INFRASTRUCTURE_NOT_PROVEN`
