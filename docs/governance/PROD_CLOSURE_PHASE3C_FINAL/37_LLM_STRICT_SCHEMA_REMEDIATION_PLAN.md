# 37 — LLM Strict Schema Remediation Plan

Task: `MIRA-P3C-LLM-STRICT-SCHEMA-CLOSURE-2026-08-31`

## Proven defect

- previous provider mode: `response_format.type = json_object`;
- JSON syntax was enforced, field contract was not;
- real response returned illegal enum values;
- parser accepted strings;
- validator rejected them;
- Claim Lock was not reached;
- trusted fake success: 0.

Root cause: `MODEL_STRUCTURED_OUTPUT_NOT_ENFORCED`.

## Bounded remediation

1. Export change-action and preference-alignment arrays from their existing
   domain type module.
2. Build one OpenAI strict JSON Schema from canonical enum arrays and the
   existing `FashionAdviceCandidateDraft` shape.
3. Set `response_format.type = json_schema` and `strict = true`.
4. Require all strict-schema properties; represent optional scalar values as
   nullable and optional arrays as empty arrays.
5. Set `additionalProperties = false` at every object boundary.
6. Remove the ambiguous prompt shape hint; leave semantic/evidence/safety
   instructions in the prompt.
7. Preserve parser, validator, Claim Lock and all frozen laws unchanged.

## Scope

Changed source is limited to five Fashion Knowledge files:

- canonical alternative enum exports;
- provider schema;
- provider request construction;
- provider barrel export;
- AT-2 contract tests.

No provider, infrastructure, database, Firebase, Redis, Perfect, FASHN,
deployment or production flag was changed.
