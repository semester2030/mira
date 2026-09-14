# AT-4R — Backend Flag Configuration (Local QA Only)

## Enable (local `.env.qa` only)
```
FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=true
FASHION_KNOWLEDGE_LLM_ENABLED=true
```

## Keep false
```
FASHION_KNOWLEDGE_TELEMETRY_ENABLED=false
FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED=false
FASHION_KNOWLEDGE_REGISTRY_ENABLED=false
FASHION_KNOWLEDGE_ACCESSORIES_ENABLED=false
FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED=false
FASHION_KNOWLEDGE_CULTURAL_CONTEXT_ENABLED=false
```

## Production
`render.yaml` defines sole service `mira-api` — **no** Fashion Knowledge flags were added or flipped in AT-4R.
Production remains unactivated.
