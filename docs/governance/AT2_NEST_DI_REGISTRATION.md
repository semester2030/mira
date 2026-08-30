# AT-2 — Nest DI Registration

Module: `AdvisorModule`
Token: `FASHION_KNOWLEDGE_LLM_PORT` (from `advisor.service.ts`)
Factory: `(config: ConfigService) => new OpenAiFashionKnowledgeLlmProvider(config)`
Scope: singleton default
Export: token exported for tests
Mock: never registered in production module
