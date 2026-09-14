# FK-13 — Nest DI Audit

## AdvisorModule providers
`AdvisorService`, `BeautyAdvisorService` only.

## FashionKnowledgeLlmPort
- Token: `FASHION_KNOWLEDGE_LLM_PORT` (`@Optional() @Inject`)
- **No provider registered** in `AdvisorModule` or searched app modules.
- Runtime Nest: `fashionLlmPort === undefined`.

## Classification
| Dimension | Status |
|-----------|--------|
| Architecture ready | YES |
| Wiring ready | YES (optional inject hook) |
| Production activatable Mode B | **NO** |
| Fail-closed without provider | YES (`MODE_B_PROVIDER_MISSING`) |
