# AT-2 — Implementation Report

## Scope
Activation-layer Nest provider only.

## Created
- `mira-api/src/fashion-knowledge/llm/providers/openai-fashion-knowledge-llm.provider.ts`
- `mira-api/src/fashion-knowledge/llm/providers/openai-provider-config.ts`
- `mira-api/src/fashion-knowledge/llm/providers/openai-fashion-draft.parser.ts`
- `mira-api/src/fashion-knowledge/llm/providers/openai-fashion-draft.schema.ts`
- `mira-api/src/fashion-knowledge/llm/providers/index.ts`
- `mira-api/src/fashion-knowledge/phase-at2-production-llm-provider.schema-tests.ts`
- `docs/governance/AT2_*.md`

## Modified
- `mira-api/src/advisor/advisor.module.ts` — register `FASHION_KNOWLEDGE_LLM_PORT`
- `mira-api/src/fashion-knowledge/llm/index.ts` — export production provider
- `mira-api/src/fashion-knowledge/versioning/release.ts` — additive `FASHION_KNOWLEDGE_ACTIVATION_TRACK`
- `mira-api/package.json` — `test:at2`

## Unchanged (verified)
- FK-3 port interface
- Claim Lock / draft mapper / prompt policy semantics
- Flutter
- `render.yaml` Fashion Knowledge flags (none enabled)
- `FASHION_KNOWLEDGE_RELEASE = 1.0.0-fashion-knowledge`
