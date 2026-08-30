# AT-2 — Provider Configuration

| Variable | Role | Required for configure |
|----------|------|------------------------|
| LLM_API_KEY | auth | YES |
| LLM_BASE_URL | endpoint (https) | default openai |
| LLM_MODEL | model id | default gpt-4o-mini |
| LLM_TEMPERATURE | base temp | optional |
| LLM_TIMEOUT_MS | fallback timeout | optional |
| FASHION_KNOWLEDGE_LLM_BASE_URL | override | optional |
| FASHION_KNOWLEDGE_LLM_MODEL | override | optional |
| FASHION_KNOWLEDGE_LLM_TEMPERATURE | override | optional |
| FASHION_KNOWLEDGE_LLM_TIMEOUT_MS | override (default 15000) | optional |
| FASHION_KNOWLEDGE_LLM_MAX_OUTPUT_TOKENS | default 1200 | optional |
| FASHION_KNOWLEDGE_LLM_PROVIDER | providerId label | optional |
| FASHION_KNOWLEDGE_LLM_ENABLED | Mode B gate | default false — NOT enabled by AT-2 |

No secret values in docs.
