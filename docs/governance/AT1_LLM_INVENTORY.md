# AT-1 — LLM / Provider Inventory

| Integration | File/Service | Provider | Model env | Endpoint | Key | Structured | Owner | Reusable by FKL? |
|-------------|--------------|----------|-----------|----------|-----|------------|-------|------------------|
| MCE consultation | `mce-llm.service.ts` | OpenAI | `MCE_LLM_MODEL` \|\| `LLM_MODEL` (gpt-4o-mini) | `/chat/completions` | `LLM_API_KEY` | `json_object` | Consultation/MCE | Transport pattern YES; class coupling NO |
| Legacy OI reasoning | `llm-outfit-reasoning.service.ts` | OpenAI | `LLM_MODEL` | `/chat/completions` | `LLM_API_KEY` | `json_object` | AI gateway legacy | Pattern only; scores/prescriptions LEGACY |
| Vision semantics | `openai-semantic.provider.ts` | OpenAI | vision config | `/chat/completions` | shared OpenAI key pattern | `json_schema` strict | Vision Platform | Pattern for schema YES; different domain |
| FKL mock | `mock-provider.ts` | mock | n/a | n/a | n/a | draft object | Tests | TEST_ONLY |
| FKL production port | `FashionKnowledgeLlmPort` | none | `FASHION_KNOWLEDGE_LLM_*` | none | none wired | required draft | Fashion Knowledge | MISSING implementation |

Render already declares: `LLM_API_KEY` (sync:false), `LLM_BASE_URL`, `LLM_MODEL=gpt-4o-mini`, `LLM_TEMPERATURE=0.2`.
No `FASHION_KNOWLEDGE_*` env keys in render.yaml.
