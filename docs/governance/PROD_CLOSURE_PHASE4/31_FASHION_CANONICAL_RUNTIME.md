# Fashion Canonical Runtime

Deployed-source and runtime evidence confirm:

- canonical endpoint is `/api/v1/ai/vision/outfit/analyze`
- authenticated malformed request returned 400 before provider execution
- DTO non-whitelisted input returned 400
- production rate-limit control uses fail-closed Redis semantics
- legacy scored/mock path remains blocked in production
- FASHN provider files are unchanged from real acceptance
- strict LLM schema is present in the deployed exact SHA
- parser, validator, projection, and Claim Lock regressions passed

No provider call or synthetic scored result was generated in Phase 4B.

- `FASHION_CANONICAL_RUNTIME = PASS`
- `LEGACY_PRODUCTION_BYPASS = 0`
