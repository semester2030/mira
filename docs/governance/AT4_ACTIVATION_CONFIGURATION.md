# AT-4 — Activation Configuration / Flag Matrix

## Planned QA-only matrix (NOT applied to production)

| Flag | QA value | Applied this run? |
|------|----------|-------------------|
| FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED | true | **No** (no safe env+key) |
| FASHION_KNOWLEDGE_LLM_ENABLED | true | **No** |
| FASHION_KNOWLEDGE_REGISTRY_ENABLED | false | N/A (default) |
| FASHION_KNOWLEDGE_ACCESSORIES_ENABLED | false | N/A |
| FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED | false | N/A |
| FASHION_KNOWLEDGE_CULTURAL_CONTEXT_ENABLED | false | N/A |
| FASHION_KNOWLEDGE_TELEMETRY_ENABLED | **false** | Verified not true |
| FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED | **false** | Verified quarantine |
| MIRA_FASHION_ADVISOR_V1 | true (QA Flutter only) | **Not built** this run |

## Model config (from repo defaults / examples — no secrets)
- Model: `gpt-4o-mini`
- Base URL class: `https://api.openai.com/v1`
- Temperature: `0.2`
- Timeout: `15000` ms (FKL) / example `45000` ms shared
- Max output tokens: `1200`
- Max provider attempts: FK-3 `2`

## Secrets
| Name | Local `.env` | Render declaration |
|------|--------------|--------------------|
| LLM_API_KEY | **MISSING** | declared `sync: false` |
| LLM_BASE_URL | MISSING locally | SET in blueprint |
| LLM_MODEL | MISSING locally | SET `gpt-4o-mini` |

## Production isolation
`render.yaml` contains **zero** `FASHION_KNOWLEDGE_*` keys after AT-4.
Production remains unactivated.
