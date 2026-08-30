# AT-2 — Provider Architecture

```
AdvisorService (@Optional FASHION_KNOWLEDGE_LLM_PORT)
        ↓ (when flags ON — still default OFF)
resolveFashionEvidenceForAdvisorChat
        ↓
runFashionKnowledgeAdvisorBridge / Mode B
        ↓
FashionKnowledgeLlmPort.generateStructuredDraft
        ↓
OpenAiFashionKnowledgeLlmProvider
        ↓  HTTPS Chat Completions (json_object)
        ↓
parseOpenAiFashionDraftJson
        ↓
FK-3 validateFashionLlmDraft → mapLlmDraftToCandidate → Claim Lock
```

## Isolation
- No dependency on `MceLlmService`
- Shared secrets only: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`
- Provider metadata (`providerAuditId`, token usage, model) stays server-audit only

## Fail-closed
Missing key / invalid URL / timeout / 401 / malformed → `FashionLlmProviderResult` non-ok → no fabricated candidate.
