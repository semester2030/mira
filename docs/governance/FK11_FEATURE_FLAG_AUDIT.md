# FK-11 — Feature Flag Audit

All FK flags default **false**:
- FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED
- FASHION_KNOWLEDGE_LLM_ENABLED
- FASHION_KNOWLEDGE_REGISTRY_ENABLED
- FASHION_KNOWLEDGE_ACCESSORIES_ENABLED
- FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED
- FASHION_KNOWLEDGE_CULTURAL_CONTEXT_ENABLED
- FASHION_KNOWLEDGE_TELEMETRY_ENABLED

## Combination matrix (behavior)

| Integration | LLM | Registry ACTIVE | User fashion ask via Advisor | User fashion ask via MCE |
|-------------|-----|-----------------|------------------------------|---------------------------|
| OFF | * | 0 | Beauty Advisor clarify/legacy units (no FK Mode B) | **Unrestricted LLM fashion possible** |
| ON | OFF | 0 | Unavailable units (no invent) | Quarantined |
| ON | ON | 0 | **Still unavailable** (bridge unwired) | Quarantined |
| ON | ON | >0 | Still unavailable until bridge wired | Quarantined |

## Unsafe combinations
1. Integration OFF — MCE fashion open (**MAJOR**, default)
2. Integration ON + LLM ON — claimed Mode B still unreachable on `/advisor/chat` (**MAJOR**)
3. Telemetry ON without consent — **CRITICAL policy** if enabled
