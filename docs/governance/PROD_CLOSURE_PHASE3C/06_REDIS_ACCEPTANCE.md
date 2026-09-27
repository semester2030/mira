# Phase 3C — Redis/Valkey Acceptance

## Existing local infrastructure

The ignored environment points to a local, non-TLS, unauthenticated Redis
endpoint. A single randomly named `mira:phase3c:acceptance:*` key was used.

- connection: PASS
- PING: PASS
- dedicated write/read: PASS
- 30-second TTL: PASS
- dedicated key deletion: PASS
- observed total: `43 ms`
- unrelated keys inspected: `0`

This is one local acceptance sample and is not a production latency/SLA claim.

## Production infrastructure

`render.yaml` declares no Key Value service and no `REDIS_URL`. Render
workspace listing remained unauthorized after authentication, so a manually
provisioned production instance cannot be confirmed or denied.

- production instance: `UNKNOWN`
- production credential: `UNKNOWN`
- production TLS/network/TTL/concurrency: `NOT_TESTED`

## Critical failure safety

Phase 3B Redis regressions reran successfully:

- absent/configuration failure → protected operation 503;
- command and partial INCR/EXPIRE failure → fail closed;
- normal over-limit → 429;
- optional FAQ cache only → best-effort fail open.

## Verdict

`BLOCKED_OWNER_ACTION`

Local runtime behavior is accepted. Production Redis is not accepted until
read-only Render access proves an existing instance or the owner separately
authorizes provisioning and secure wiring.
