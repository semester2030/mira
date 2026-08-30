# AT-1 — Safe Year-1 Flag Configuration (DO NOT APPLY)

## Minimum for Mode B advice QA
| Flag | Planned | Rationale |
|------|---------|-----------|
| FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED | true | Opens bridge on `/advisor/chat` |
| FASHION_KNOWLEDGE_LLM_ENABLED | true | Mode B |
| FASHION_KNOWLEDGE_REGISTRY_ENABLED | false | ACTIVE=0; Mode A empty either way |
| FASHION_KNOWLEDGE_ACCESSORIES_ENABLED | false unless testing accessories | Minimum surface |
| FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED | false unless testing form | Minimum surface |
| FASHION_KNOWLEDGE_CULTURAL_CONTEXT_ENABLED | false unless testing culture | Minimum surface |
| FASHION_KNOWLEDGE_TELEMETRY_ENABLED | **false** | Defer consent |
| FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED | **false** | Keep quarantine |

## Also require
- Production Nest provider registered
- Client calling `/advisor/chat` with fashion context
- LLM_API_KEY present (already Render pattern)

**Do not apply in AT-1.**
