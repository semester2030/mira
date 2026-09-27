# 31 — LLM Attempt 1 Validation Forensic

Attempt 1 is historical input from the execution-continuation run.

## Proven boundary

| Stage | Result |
|---|---|
| real provider response | YES |
| JSON parser | PASS |
| `validateFashionLlmDraft` | FAIL |
| Claim Lock | NOT REACHED |
| trusted output | NO |

The runtime stage was `draft_validation` and status was `BLOCKED`.

## Evidence limitation

The original one-shot process printed neither
`audit.validationIssueCodes` nor a sanitized draft shape. Raw provider content
was intentionally not persisted. Therefore the exact historical field/path
cannot be reconstructed without inventing evidence.

Exact attempt-1 rule/path:

`UNKNOWN_WITH_EVIDENCE`

The possible rule set is bounded to:

- `validateLlmCandidateDraft`: missing subjectivity, known-rule wording,
  absolute claim, fabricated citation;
- `validateFashionLlmDraft`: schema/advice enum, allowlist, enum values,
  missing observation/evidence, unresolved evidence, forbidden flag;
- output sanitization: prompt/provider leakage, unsupported citation/product
  availability, tone/body/cultural restrictions.

## Safety purpose and result

Whatever the exact issue, the parsed draft never became a candidate and never
reached Claim Lock or user-facing trusted advice.

`EXPECTED FAIL-CLOSED SAFETY = PASS`

No claim is made that this historical response proves a source defect.
