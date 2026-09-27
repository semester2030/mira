# Phase 4B Scope and Baseline

- Task: `MIRA-P4B-PRODUCTION-RUNTIME-ACCEPTANCE-2026-08-31`
- Mode: controlled production acceptance; evidence-first; fail-closed
- Approved/live SHA: `a2484658aa74e10df9b2c046b065e4b823238e15`
- Deploy: `dep-daafo6dg1s2s73d22sog`
- Service: `mira-api` / `srv-d85ngcfavr4c73d3rk6g`

No source, environment, deployment, billing, provider subscription, customer
data, or global feature state was changed. Tests used temporary non-customer
Firebase identities, a unique Redis namespace, malformed synthetic requests,
and isolated Render jobs from the current image.

Phase 4B stopped short of PASS after a real account-deletion security defect
and an unavailable positive owner-allowlist path were proven. No remediation
was performed.
