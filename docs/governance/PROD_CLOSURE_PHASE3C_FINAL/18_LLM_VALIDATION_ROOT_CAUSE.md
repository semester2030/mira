# Phase 3C Final — LLM Validation Root Cause

Date: 2026-08-31
Source: `4b2c78ac42fef38dc0012a35ba6879ae4d6a4a74`

## Request 1 (continuation evidence)

Canonical provider: `OpenAiFashionKnowledgeLlmProvider` +
`runFashionKnowledgeLlm()`.

| Check | Result |
|---|---|
| REAL_RESPONSE | YES |
| PARSER | PASS |
| MOCK | NO |
| runtime stage | `draft_validation` |
| runtime status | `BLOCKED` |
| Claim Lock invoked | NO |
| trusted advice shown | NO |

Exact validator issue codes were not retained on that run. Forensic bound:
failure was after `parseOpenAiFashionDraftJson` and inside
`validateFashionLlmDraft` / `validateLlmCandidateDraft` / output sanitization
before `evaluateFashionClaimLock`.

That is fail-closed safety, not a fake success.

## Request 2 (authorized additional, codes captured)

Same frozen adapter. Harmless AT-2 red/yellow/wedding fixture. Retries = 0.

| Check | Result |
|---|---|
| REAL_RESPONSE | YES (`providerAuditId` present) |
| PARSER | FAIL |
| parser/runtime reason | `schema_mismatch` |
| runtime stage | `provider_call` |
| runtime status | `FAILED` |
| VALIDATION_CODES | `[]` (validator not reached) |
| Claim Lock | NOT REACHED |
| MOCK | NO |

`schema_mismatch` is returned by `parseOpenAiFashionDraftJson` when the JSON
object exists but alternatives/root/occasionContext fail the strict draft
schema. Enum legality is intentionally deferred to the validator; this failure
is earlier: structural contract.

### Rejection record (request 2)

| Field | Value |
|---|---|
| VALIDATOR | `parseOpenAiFashionDraftJson` (pre-Claim-Lock parser) |
| EXPECTED CONTRACT | FashionAdviceCandidateDraft JSON: required fields, alternatives array with legal change/alignment entries |
| ACTUAL SANITIZED SHAPE | real HTTP content present; no draft object materialized |
| WHY REJECTED | `schema_mismatch` |
| SECURITY/TRUST PURPOSE | refuse unstructured or illegally shaped model JSON before it becomes advice |
| PROVIDER OUTPUT INVALID | YES relative to frozen schema |
| PROMPT/SCHEMA MISALIGNED | POSSIBLE (model may omit strict alternative shape) — not proven as a source bug |
| CODE DEFECT | NO — parser fail-closed as designed; AT-2 proves a conforming draft maps and Claim-Locks |

## Request 1 inferred (codes missing)

Likely class: non-conforming but parseable draft rejected by
`validateFashionLlmDraft` (evidence subset, enums, absoluteClaim,
knownRuleWording, sanitizers). Without codes this remains unspecific.

## Final root cause

`PROVIDER_OUTPUT_CONTRACT_VIOLATION`

A correct safety rejection is not a code defect. Frozen Fashion Knowledge
laws were not weakened. Claim Lock was not bypassed.

Negative-path evidence: two real responses; neither produced trusted advice.

Positive-path (parser → validation → Claim Lock → safe candidate) remains
proven only on mocked conforming drafts (AT-2), not on a live provider
payload.

| Required | Status |
|---|---|
| REAL_RESPONSE | YES |
| PARSER | PASS (request 1) / FAIL (request 2) |
| VALIDATION | FAIL (request 1) / NOT REACHED (request 2) |
| CLAIM_LOCK | NOT REACHED |
| MOCK | NO |
