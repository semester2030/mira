# Phase 3C — Acceptance Latency Evidence

`ONE ACCEPTANCE SAMPLE — NOT SLA`

| Target | Operation | Outcome | Observed |
|---|---|---|---:|
| Render API | health | HTTP 200 | 605 ms |
| Render API | public features | HTTP 200 | 537 ms |
| Render + PostgreSQL | Prisma-backed stats | HTTP 200 | 997 ms |
| Render API | entitlement route | HTTP 404 | 512 ms |
| Firebase Admin guard | missing token rejection | HTTP 401 | 517 ms |
| Firebase Admin guard | invalid token rejection | HTTP 401 | 503 ms |
| OpenAI edge | unauthenticated models request | HTTP 401 | 630 ms |
| FASHN edge | unauthenticated run-path GET | HTTP 403 | 604 ms |
| Perfect Corp edge | unauthenticated S2S root | HTTP 404 | 1501 ms |
| local Redis | connect/ping/write/TTL/delete | PASS | 43 ms |
| local PostgreSQL | read-only `SELECT 1` | PASS | 135 ms |
| TFHub BlazeFace | production preload | fetch failure | ~10.8 s |

No real paid inference completed, so there is no provider-processing or polling
latency sample for Perfect Corp, FASHN or the LLM. Edge rejection latency must
not be represented as inference latency.
