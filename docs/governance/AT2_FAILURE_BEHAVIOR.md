# AT-2 — Failure Behavior

| Condition | Result |
|-----------|--------|
| Missing LLM_API_KEY | FAILED / PROVIDER_CONFIG_MISSING (no HTTP) |
| Non-https base URL | PROVIDER_CONFIG_INVALID |
| Timeout | status timeout |
| 401/403 | PROVIDER_AUTH_FAILURE |
| 429/5xx | transient_provider_error |
| Malformed JSON | malformed |
| Flag OFF | DISABLED — zero provider calls |

No MCE fashion fallback. No mock fallback.
