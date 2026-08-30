# FK-3 — Provider Port

`FashionKnowledgeLlmPort` in `llm/provider-port.ts`

- Accepts request + prompt bundle only
- Returns `FashionLlmProviderResult` (ok/malformed/timeout/failed/blocked)
- Provider audit id is server-only
- Domain contracts independent of OpenAI/Anthropic/Gemini
