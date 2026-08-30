# FK-3 — Retry & Failure

Retryable: malformed_json, schema_mismatch, timeout, transient_provider_error (max 2 attempts).
Never retry: attractiveness, fake_citation, claim_lock_block, safety blocks.
Provider failure → FAILED runtime, **no fabricated candidate**.
