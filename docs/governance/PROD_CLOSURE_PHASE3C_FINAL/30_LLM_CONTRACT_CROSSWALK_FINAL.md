# 30 — LLM Contract Crosswalk Final

Task: `MIRA-P3C-FINAL-ACCEPTANCE-2026-08-31`

## Canonical chain

`AdvisorService` / Fashion Knowledge integration  
→ `runFashionKnowledgeLlm()`  
→ `buildFashionLlmPrompt()`  
→ `OpenAiFashionKnowledgeLlmProvider.generateStructuredDraft()`  
→ OpenAI-compatible `/chat/completions`  
→ `choices[0].message.content`  
→ `parseOpenAiFashionDraftJson()`  
→ `validateFashionLlmDraft()` + `validateLlmCandidateDraft()`  
→ `mapLlmDraftToCandidate()`  
→ `evaluateFashionClaimLock()`  
→ qualified/blocked canonical candidate.

## Structured-output enforcement

The request sends:

```text
response_format = { type: "json_object" }
```

There is no `json_schema`, `strict: true`, tool/function schema, or field-level
provider schema. The model receives a prompt shape hint only.

`LLM STRUCTURED OUTPUT MODE = JSON_MODE_ONLY`

`MODEL STRUCTURED OUTPUT STRICTLY ENFORCED = NO`

## Field-by-field crosswalk

Provider schema column is `JSON object only` for every field because no strict
provider schema is supplied.

| Field | Prompt/shape hint | Provider schema | Parser | Validator | Claim Lock / mapper | Type / enum | Required |
|---|---|---|---|---|---|---|---|
| `draftId` | string | object only | non-empty string ≤160 | required | candidate hash input | string | yes |
| `schemaVersion` | exact `fashion-advice-candidate-v1` | object only | string; defaults if absent | exact version | mapper forces exact version | enum-like constant | effectively yes, parser defaults |
| `adviceType` | `FashionAdviceType enum string` | object only | any non-empty string | exact enum + request allowlist | Claim Lock G2 | 30 uppercase values | yes |
| `targetRefs` | string array | object only | string array ≤32 | base policy only | candidate targets | string[] | yes |
| `currentObservation` | string | object only | non-empty ≤2000 | non-empty + sanitizers | candidate/lock evidence context | string | yes |
| `suggestion` | structured object | object only | object | base safety | candidate advice | object | yes |
| `suggestion.structuredText` | string | object only | non-empty ≤2000 | sanitizers | public claim gates | string | yes |
| `suggestion.adviceType` | enum label | object only | any non-empty string | not independently enum-checked | copied into candidate | FashionAdviceType intended | yes |
| `suggestion.absoluteClaim` | `false` | object only | boolean | must be false | G12/G14 safety | boolean | yes |
| `suggestion.knownRuleWording` | `false` | object only | boolean | must be false | provenance gates | boolean | yes |
| `rationale` | string | object only | non-empty ≤2000 | citation/safety sanitizers | candidate rationale | string | yes |
| `evidenceRefs` | subset of request refs | object only | string array | non-empty + exact subset | G6 evidence resolves | string[] | yes |
| `subjectivity` | symbolic `SubjectivityLevel` | object only | any string | exact uppercase enum | G4 / confidence ceiling | LOW/MEDIUM/HIGH_SUBJECTIVITY, TREND_DEPENDENT, USER_DEPENDENT | yes |
| `knowledgeType` | preferred `LLM_GENERAL_KNOWLEDGE` | object only | any string if present | exact enum | mapper policy/downgrade; G3 | KnowledgeType enum | optional |
| `confidenceEstimate` | LOW/MEDIUM/UNVERIFIED preferred | object only | any string if present | exact enum | mapper caps HIGH; G11 | HIGH/MEDIUM/LOW/UNVERIFIED | optional |
| `preferenceConflict` | symbolic `ConflictState` | object only | any string if present | exact uppercase enum | G9 | NO_CONFLICT/POSSIBLE_CONFLICT/DIRECT_CONFLICT/UNKNOWN | optional |
| `culturalConflict` | symbolic `ConflictState` | object only | any string if present | exact uppercase enum | G10 | same ConflictState | optional |
| `occasionDependency` | boolean | object only | boolean if present | contextual checks | missing occasion path | boolean | optional |
| `occasionContext` | string array | object only | string array or parser failure | invented-occasion rule | applicability gates | string[] | optional |
| `assumptions` | string array | object only | string array | sanitized as text | limitations/lock context | string[] | optional |
| `clarificationNeeds` | string array | object only | string array | contextual | clarification path | string[] | optional |
| `alternatives` | array with detailed shape | object only | array ≤8; every nested field required | no full nested enum validation here | candidate alternatives / subjectivity policy | FashionAdviceAlternative[] | yes |
| `alternatives[].alternativeId` | string | object only | required string | indirect | candidate | string | yes |
| `alternatives[].direction` | string | object only | required string | indirect | candidate | string | yes |
| `alternatives[].changes` | array | object only | required array ≤32 | indirect | candidate | change[] | yes |
| `changes[].changeId` | string | object only | required | indirect | candidate | string | yes |
| `changes[].targetRef` | string | object only | required | indirect | evidence/applicability | string | yes |
| `changes[].action` | partial enum hint | object only | any non-empty string | not independently checked | typed candidate consumer | keep/soften_color/neutralize_color/increase_formality/decrease_formality/add/remove/replace_direction/other | yes |
| `changes[].toDirection` | optional string | object only | optional string | indirect | candidate | string | no |
| `changes[].notes` | not in compact hint | object only | optional string | indirect | candidate | string | no |
| `alternatives[].expectedStyleEffect` | string | object only | required | indirect | candidate | string | yes |
| `alternatives[].evidenceRefs` | string array | object only | required | not subset-checked here | candidate | string[] | yes |
| `alternatives[].ruleRefs` | empty array hint | object only | required (defaults only if field null via parser expression) | indirect | candidate | string[] | yes |
| `alternatives[].confidence` | symbolic KnowledgeConfidence | object only | any string | no nested enum check here | candidate | KnowledgeConfidence intended | yes |
| `alternatives[].subjectivity` | symbolic SubjectivityLevel | object only | any string | no nested enum check here | candidate | SubjectivityLevel intended | yes |
| `alternatives[].qualification` | string | object only | required | indirect | candidate | string | yes |
| `alternatives[].preferenceAlignment` | explicit enum | object only | exact lowercase enum | indirect | candidate | aligned/partial/opposed/unknown | yes |
| `limitations` | string array | object only | required array | sanitized text | candidate limitations | string[] | yes |
| `createdAt` | exact request clock | object only | required string | no equality check in validator | candidate timestamp | ISO string intended | yes |
| `traceId` | exact request trace | object only | optional string | no equality check | mapper uses request trace, not provider trace | string | optional |
| `forbiddenClaimDetected` | `false` | object only | optional boolean | true blocks | G14 | boolean | optional |

Unknown root fields are tolerated except explicit banned provider/leakage
fields. The parser does not invent required fields.

## Alignment decision

The business/safety intent is consistent, but the executable contracts are not
the same:

1. provider receives JSON mode, not the field schema;
2. prompt names `SubjectivityLevel` and `ConflictState` without listing their
   legal values;
3. parser accepts arbitrary strings for those enums;
4. validator later requires exact uppercase internal enum values;
5. several nested alternative enums are typed but not fully validated;
6. provider `createdAt`/`traceId` exactness is prompted but not validator-enforced.

`MIRA CONTRACT ALIGNMENT = FAIL`

Primary root cause:

`MODEL_STRUCTURED_OUTPUT_NOT_ENFORCED`

Secondary:

`PROMPT_SCHEMA_MISMATCH` and a deliberately permissive parser/strict-validator
boundary.

## Smallest bounded remediation

Use provider-supported strict `json_schema` structured output with:

- all required fields and nested fields;
- exact enum arrays;
- `additionalProperties: false`;
- exact boolean constraints where supported;
- explicit nullable/optional representation;
- model compatibility check.

Keep the parser, validator and Claim Lock. Do not weaken any safety rule.
