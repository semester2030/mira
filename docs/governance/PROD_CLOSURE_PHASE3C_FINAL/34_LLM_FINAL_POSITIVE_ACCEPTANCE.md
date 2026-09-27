# 34 — LLM Final Positive Acceptance

Task: `MIRA-P3C-FINAL-ACCEPTANCE-2026-08-31`

Precondition assessment before the call:

- semantic safety contract appeared aligned;
- provider enforcement was only JSON mode;
- retries forced to zero;
- one final real request authorized;
- harmless red/yellow/wedding synthetic context;
- production provider and canonical orchestrator;
- no mock or alternate parser.

## Result

| Stage | Result |
|---|---|
| real provider | YES |
| real response | YES |
| parser | PASS |
| validator | FAIL |
| Claim Lock | NOT REACHED |
| canonical result | NOT PROVEN |
| mock | NO |
| unsupported trusted claims | 0 |

Runtime:

- stage: `draft_validation`;
- status: `BLOCKED`;
- reason: `missing_subjectivity`;
- attempts: 1.

## Exact rejection crosswalk

| Field | Actual sanitized value | Parser | Validator expected | Result |
|---|---|---|---|---|
| `subjectivity` | `SUBJECTIVE` | accepts any string | one of `LOW_SUBJECTIVITY`, `MEDIUM_SUBJECTIVITY`, `HIGH_SUBJECTIVITY`, `TREND_DEPENDENT`, `USER_DEPENDENT` | `missing_subjectivity` |
| `preferenceConflict` | `unknown` | accepts any string | uppercase `UNKNOWN` or other `ConflictState` | `invalid_preference_conflict` |
| `culturalConflict` | `unknown` | accepts any string | uppercase `UNKNOWN` or other `ConflictState` | `invalid_cultural_conflict` |

Other sanitized shape:

- schema: `fashion-advice-candidate-v1`;
- advice type: `INCREASE_CONTRAST`;
- target refs: 2;
- observation: string;
- suggestion: object;
- evidence refs: 3;
- alternatives: 1;
- limitations: 1;
- knowledge type: `LLM_GENERAL_KNOWLEDGE`;
- confidence: `MEDIUM`;
- forbidden flag: false.

## Forensic decision

The model was told symbolic enum type names but not given strict enum arrays.
`response_format` guaranteed only a JSON object. The parser intentionally
accepted strings and deferred enum legality to the validator. The validator
correctly rejected the non-conforming values.

Primary root cause:

`MODEL_STRUCTURED_OUTPUT_NOT_ENFORCED`

Contributing:

- `PROMPT_SCHEMA_MISMATCH` (enum names without complete legal values);
- permissive parser / strict validator boundary.

`MIRA CONTRACT ALIGNMENT = FAIL`

`NEW_CODE_REMEDIATION_REQUIRED = YES`

Bounded remediation: replace JSON mode with a strict provider JSON schema
containing exact required fields, nested shapes and enum values. Preserve
parser, validator, Claim Lock and all Fashion Knowledge laws.

No source change was made under this acceptance task.
