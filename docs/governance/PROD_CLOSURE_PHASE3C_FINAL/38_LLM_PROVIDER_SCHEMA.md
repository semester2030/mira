# 38 — LLM Provider Schema

Implementation:
`mira-api/src/fashion-knowledge/llm/providers/openai-fashion-draft.schema.ts`

## Provider mechanism

```text
response_format.type = json_schema
json_schema.name = mira_fashion_advice_candidate_v1
json_schema.strict = true
```

Every object uses `additionalProperties: false`. Every declared property is
listed in `required`, as required by OpenAI strict structured outputs.

## Root contract

Required fields:

`draftId`, `schemaVersion`, `adviceType`, `targetRefs`,
`currentObservation`, `suggestion`, `rationale`, `evidenceRefs`,
`subjectivity`, `occasionContext`, `alternatives`, `limitations`, `createdAt`,
`traceId`, `knowledgeType`, `confidenceEstimate`, `preferenceConflict`,
`culturalConflict`, `occasionDependency`, `assumptions`,
`clarificationNeeds`, `forbiddenClaimDetected`.

Optional domain scalars are represented as nullable. Optional domain arrays
are represented by empty arrays.

## Exact enum sources

- advice types: `ALL_FASHION_ADVICE_TYPES`;
- subjectivity: `ALL_SUBJECTIVITY_LEVELS`;
- knowledge types: `ALL_KNOWLEDGE_TYPES`;
- confidence: `ALL_KNOWLEDGE_CONFIDENCE`;
- conflicts: `ALL_CONFLICT_STATES`;
- change actions: `FASHION_ADVICE_CHANGE_ACTIONS`;
- preference alignment: `FASHION_ADVICE_PREFERENCE_ALIGNMENTS`;
- schema version: `FASHION_ADVICE_CANDIDATE_VERSION`.

This prevents provider/domain enum drift.

Subjectivity values:

`LOW_SUBJECTIVITY`, `MEDIUM_SUBJECTIVITY`, `HIGH_SUBJECTIVITY`,
`TREND_DEPENDENT`, `USER_DEPENDENT`.

Conflict values:

`NO_CONFLICT`, `POSSIBLE_CONFLICT`, `DIRECT_CONFLICT`, `UNKNOWN`.

Change actions:

`keep`, `soften_color`, `neutralize_color`, `increase_formality`,
`decrease_formality`, `add`, `remove`, `replace_direction`, `other`.

## Nested enforcement

`suggestion`, every `alternative`, and every `change` are strict nested
objects. Alternatives are capped at 8 and nested arrays at 32. Required
safety booleans `absoluteClaim`, `knownRuleWording` and
`forbiddenClaimDetected` are constrained to `false`.

The configured OpenAI `gpt-4o-mini` request accepted this strict schema in the
real acceptance call; no fallback to JSON mode occurred.
