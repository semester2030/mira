# Phase 3C — OpenAI-compatible LLM Acceptance

## Revalidated architecture

Canonical configurations read `LLM_API_KEY`, `LLM_BASE_URL` and `LLM_MODEL`,
with bounded subsystem overrides. The principal structured Fashion acceptance
adapter is `OpenAiFashionKnowledgeLlmProvider`; Vision semantics and MCE use the
same base credential contract.

The provider adapter validates HTTPS configuration, structured output, parser
shape, provenance/audit fields and explicit provider failure. Existing Claim
Lock/Fashion Knowledge regressions remain the safety proof; they are not a real
provider response.

## Configuration/account evidence

- local credential: `MISSING`;
- local base/model overrides: `MISSING` (safe defaults exist in code);
- Blueprint declares key, OpenAI-compatible base and model;
- live credential/account/model status: `UNKNOWN`;
- unauthenticated OpenAI edge: reachable and rejected (`HTTP 401`, 630 ms);
- billing/quota/model entitlement: `UNKNOWN`.

## Real acceptance

The existing AT4 harness supports an explicitly opted-in real provider smoke,
but its required credential is absent. It was not bypassed and no unrelated
curl was promoted as architectural acceptance.

- real structured request: `NOT_TESTED`
- real response: `NOT PROVEN`
- parser against real response: `NOT PROVEN`
- Claim Lock/safety tests: `PASS`
- mock used for real claim: `NO`
- provider calls: `0`

## Verdict

`BLOCKED_OWNER_ACTION`

Required: verify the existing account, model access, quota and billing, then
configure the key in an approved secure non-production acceptance environment.
Do not send the key in chat or commit it.
