# Phase 3C Final — Render Access and Environment Audit

## Read-only visibility

- existing Render MCP/session attempt: `unauthorized`;
- secret extraction: `NOT ATTEMPTED`;
- Dashboard mutation/deployment: `NO`;
- live API: reachable (`/health` HTTP 200);
- candidate runtime dependencies in live health: absent;
- `/entitlements/runtime`: HTTP 404;
- `/website/stats` marker: hardcoded stale `dca812d`, not deploy identity.

## Runtime configuration presence

Because read-only workspace access is unavailable, production presence is:

| Configuration | Production |
|---|---|
| Perfect configuration | UNKNOWN |
| FASHN configuration | UNKNOWN |
| `LLM_API_KEY` | UNKNOWN |
| `LLM_BASE_URL` | UNKNOWN |
| `LLM_MODEL` | UNKNOWN |
| Firebase Admin configuration | PARTIAL — live token verification path rejects invalid tokens |
| `DATABASE_URL` | PARTIAL — live Prisma-backed read evidence |
| `REDIS_URL` | UNKNOWN |
| BlazeFace/TFHub runtime configuration | UNKNOWN |

Local ignored configuration is not production evidence. It contains
`REDIS_URL` and `DATABASE_URL`, while Perfect/FASHN/LLM/Firebase acceptance
configuration is missing. No value was printed.

Production Redis existence remains `UNKNOWN`.

`VERDICT = BLOCKED_OWNER_LOGIN`
