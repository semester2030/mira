# AT-1 — OpenAI / MCE Reuse Decision

## Recommendation: **B**
Create a **separate** Fashion Knowledge Nest adapter implementing `FashionKnowledgeLlmPort`, using the same underlying OpenAI configuration (`LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`, with optional FKL-specific overrides).

## Rejected
- **A (call MceLlmService):** couples FKL to consultation ownership, message shapes, streaming, and MCE payload validation.
- **C (wholly separate vendor):** no evidence required; increases ops cost without boundary gain for Year-1.

## Evidence
- MCE uses chat completions + `json_object` for consultation payloads.
- FKL port requires `generateStructuredDraft({ request, prompt }) → FashionLlmProviderResult` with draft validation + Claim Lock downstream.
- Frozen Advisor / FKL boundaries expect provider isolation behind the port.

## AT-2 implication
One adapter class + `AdvisorModule` DI registration. Reuse secrets already on Render; do not share MCE service instance.
