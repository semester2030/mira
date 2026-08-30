# AT-2 — Retry / Timeout

- Provider timeout: `FASHION_KNOWLEDGE_LLM_TIMEOUT_MS` / `LLM_TIMEOUT_MS` (min 1000ms, default 15000)
- Orchestrator retries: FK-3 `decideLlmRetry` + `FK3_MAX_PROVIDER_ATTEMPTS=2`
- Retryable: malformed_json, schema_mismatch, timeout, transient_provider_error
- Never retry: safety / claim_lock / false_provenance / body / medical
