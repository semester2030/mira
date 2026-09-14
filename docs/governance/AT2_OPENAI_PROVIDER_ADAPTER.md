# AT-2 — OpenAI Provider Adapter

- Endpoint: `{LLM_BASE_URL}/chat/completions`
- `response_format: { type: "json_object" }`
- Model: configured `LLM_MODEL` (default gpt-4o-mini)
- Temperature: FK override or `LLM_TEMPERATURE` (capped ≤ 0.3)
- Auth: Bearer `LLM_API_KEY`
- No MCE service coupling
