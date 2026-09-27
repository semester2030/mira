# Phase 3 — Production Environment Contract

No values are recorded. `PROVEN` means runtime evidence exists; `BLUEPRINT`
means the name/default is committed but live Dashboard state is unknown.

| Name | Service / purpose | Class | Default / safety | Failure | Production presence |
|---|---|---|---|---|---|
| `NODE_ENV` | Nest production gates | REQUIRED | Render sets production | unsafe values change gates | PROVEN indirectly |
| `PORT` | HTTP bind | REQUIRED | Render-injected | boot failure | PROVEN |
| `API_PREFIX` | route prefix | REQUIRED | `api/v1` safe | route mismatch | PROVEN |
| `DATABASE_URL` | Prisma/Postgres | REQUIRED SECRET | fromDatabase | boot fails closed | PROVEN by DB-backed endpoint |
| `WEBSITE_CORS_ORIGINS` | web origins | REQUIRED CONFIG | none safe for portals | browser blocked | UNKNOWN |
| `REDIS_URL` | limits/cache | REQUIRED_FOR_SECURE_LAUNCH SECRET | absent disables Redis | **fails open** | MISSING_FROM_BLUEPRINT / live UNKNOWN |
| `RATE_LIMIT_PER_HOUR` | per-user limit | REQUIRED_WITH_REDIS | 30 | ineffective without Redis | BLUEPRINT |
| `FIREBASE_PROJECT_ID` | Admin Auth project | REQUIRED | none | 401 | PROVEN present by guard behavior |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase Admin privileged calls | REQUIRED SECRET | ADC | verify/delete may fail | UNKNOWN |
| `AUTH_SKIP` | dev bypass | TEST_ONLY | false safe | true is startup fatal | BLUEPRINT false |
| `ADMIN_API_KEY` | admin portal | REQUIRED SECRET | empty rejects | fails closed | UNKNOWN |
| `PARTNER_AUTO_APPROVE` | partner dev bypass | TEST_ONLY | false safe | true is startup fatal | BLUEPRINT false |
| `MIRA_PRODUCTION_INTERNAL_UIDS` | owner canary allowlist | FEATURE_REQUIRED SENSITIVE | empty | entitlements off | UNKNOWN |
| `MIRA_FACE_EXPERIENCE_MASTER_ENABLED` | Face UI master | FEATURE_REQUIRED | false | fails closed | candidate BLUEPRINT false; live route absent |
| `MIRA_FASHION_MODE_B_MASTER_ENABLED` | Fashion Mode B master | FEATURE_REQUIRED | false | fails closed | candidate BLUEPRINT false; live route absent |
| `SKIN_PROVIDER` | skin provider select | REQUIRED | mock default unsafe in prod | startup fatal if mock | PROVEN `perfect_corp` |
| `PERFECT_API_KEY` | YouCam credential | REQUIRED SECRET | empty | provider 503 | PROVEN PRESENT, value never exposed |
| `PERFECT_CORP_API_KEY` | legacy YouCam alias | LEGACY SECRET | empty | same | UNKNOWN / not required if primary set |
| `PERFECT_BASE_URL` | YouCam endpoint | REQUIRED | official HTTPS default | provider failure | PROVEN |
| `PERFECT_CORP_BASE_URL` | legacy URL alias | LEGACY | official default | provider failure | UNKNOWN |
| `PERFECT_CORP_DST_ACTIONS` | requested concerns | OPTIONAL | fixed list | partial/provider error | DEFAULT |
| `PERFECT_CORP_POLL_INTERVAL_MS` | polling | OPTIONAL | 1500 | latency | DEFAULT |
| `PERFECT_CORP_POLL_MAX_MS` | deadline | OPTIONAL | 90000 | timeout | DEFAULT |
| `PERFECT_CORP_FALLBACK_MOCK` | mock fallback | REQUIRED SAFETY | false | non-false startup fatal | PROVEN false |
| `MOCK_PROVIDER_ACCESS` | provider mock access | REQUIRED SAFETY | false in prod | true startup fatal | BLUEPRINT false |
| `SKIN_PROVIDER_TIMEOUT_MS` | outer deadline | OPTIONAL | 90000 | 504 | DEFAULT |
| `FASHION_PROVIDER` | canonical provider select | REQUIRED | vision_platform | unsupported/legacy fatal | candidate BLUEPRINT; live unknown |
| `FASHION_PROVIDER_TIMEOUT_MS` | fashion deadline | OPTIONAL | 90000 | 504 | DEFAULT |
| `OUTFIT_PROVIDER` | legacy route selector | LEGACY | mock | legacy route blocked | PROVEN mock/warn |
| `ALLOW_LEGACY_OUTFIT_MOCK_IN_PROD` | escape hatch | DEPRECATED/UNSAFE | false | permits fake legacy success | MISSING / must remain false |
| `FASHN_API_KEY` | FASHN credential | FEATURE_REQUIRED SECRET | empty | call fails closed | UNKNOWN |
| `FASHN_BASE_URL` | FASHN endpoint | FEATURE_REQUIRED | no code default | call fails closed | UNKNOWN |
| `FASHN_RUN_ENDPOINT` | run path | OPTIONAL | `/v1/run` | 4xx | DEFAULT |
| `FASHN_STATUS_ENDPOINT` | poll path | OPTIONAL | `/v1/status` | poll failure | DEFAULT |
| `FASHN_GEOMETRY_ENDPOINT` | endpoint alias | LEGACY | `/v1/run` | remapped from segmentation | BLUEPRINT |
| `FASHN_GEOMETRY_MODEL` | model | FEATURE_REQUIRED | background-remove | provider error | BLUEPRINT |
| `FASHN_TIMEOUT_MS` | request timeout | OPTIONAL | 20000 | abort | DEFAULT |
| `FASHN_POLL_INTERVAL_MS` | polling | OPTIONAL | 1500 | latency | DEFAULT |
| `FASHN_POLL_MAX_MS` | polling deadline | OPTIONAL | 45000 | timeout | BLUEPRINT |
| `FASHN_API_KEY_HEADER` | auth header name | OPTIONAL | Authorization | 401 | DEFAULT |
| `FASHN_API_KEY_PREFIX` | auth prefix | OPTIONAL | Bearer | 401 | DEFAULT |
| `FASHN_LEGACY_SEGMENTATION` | deprecated direct path | DEPRECATED | false | legacy call | MISSING |
| `FASHN_EDIT_MODEL` | recolor model | FEATURE_REQUIRED | edit | provider error | BLUEPRINT |
| `FASHN_EDIT_POLL_INTERVAL_MS` | recolor polling | OPTIONAL | 2000 | latency | DEFAULT |
| `FASHN_EDIT_POLL_MAX_MS` | recolor deadline | OPTIONAL | 120000 | timeout | BLUEPRINT |
| `FASHN_EDIT_RESOLUTION` | output option | OPTIONAL | provider default | quality variance | UNKNOWN |
| `FASHN_EDIT_GENERATION_MODE` | output option | OPTIONAL | provider default | quality variance | UNKNOWN |
| `QEL_ENABLED` | recolor quality layer | FEATURE_REQUIRED | true | quality layer bypass if false | BLUEPRINT |
| `QEL_ACCEPT_THRESHOLD` | QEL threshold | OPTIONAL | 0.85 | accept/reject shift | BLUEPRINT |
| `QEL_MAX_RETRIES` | QEL retries | OPTIONAL | 2 | cost/quality | BLUEPRINT |
| `QEL_SEGMENT_DRIFT` | drift gate | OPTIONAL | true | quality reduction if false | BLUEPRINT |
| `QEL_CROP_FIRST` | crop pipeline | OPTIONAL | true | quality change | BLUEPRINT |
| `QEL_CROP_PADDING` | crop padding | OPTIONAL | 0.08 | quality change | BLUEPRINT |
| `QEL_CROP_FEATHER_PX` | feather | OPTIONAL | 6 | quality change | BLUEPRINT |
| `QEL_CALIBRATION_PROFILE` | calibration | OPTIONAL | baseline | quality variance | BLUEPRINT |
| `QEL_CALIBRATION_DATASET` | runner input | TEST_ONLY | none | runner only | NOT_APPLICABLE |
| `LLM_API_KEY` | shared OpenAI-compatible credential | FEATURE_REQUIRED SECRET | empty | vision/MCE/FK blocked | UNKNOWN |
| `LLM_BASE_URL` | LLM endpoint | FEATURE_REQUIRED | OpenAI HTTPS | provider failure | BLUEPRINT; live use unknown |
| `LLM_MODEL` | model | FEATURE_REQUIRED | configured model | model error | BLUEPRINT; live proof unknown |
| `LLM_TEMPERATURE` | sampling | OPTIONAL | 0.2 | output variance | BLUEPRINT |
| `LLM_TIMEOUT_MS` | provider deadline | OPTIONAL | 45000 | timeout | DEFAULT |
| `MCE_CONSULTATION_ENABLED` | MCE master | FEATURE_REQUIRED | true | disabled response | BLUEPRINT |
| `MCE_LLM_MODEL` | MCE model override | OPTIONAL | falls back | none | UNKNOWN |
| `MCE_DAILY_LIMIT` | MCE quota | OPTIONAL | plan-derived | ineffective without Redis | UNKNOWN |
| `MCE_FAQ_CACHE` | FAQ cache | OPTIONAL | true | cache miss | BLUEPRINT |
| `MCE_FAQ_CACHE_TTL_SEC` | cache TTL | OPTIONAL | 604800 | cache variance | DEFAULT |
| `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED` | Advisor bridge | FEATURE_REQUIRED | false | feature off | MISSING_FROM_BLUEPRINT |
| `FASHION_KNOWLEDGE_LLM_ENABLED` | Mode B provider | FEATURE_REQUIRED | false | feature off | MISSING_FROM_BLUEPRINT |
| `FASHION_KNOWLEDGE_LLM_PROVIDER` | provider id | FEATURE_REQUIRED | none | feature blocked | MISSING |
| `FASHION_KNOWLEDGE_LLM_MODEL` | model override | FEATURE_REQUIRED | unconfigured | feature blocked | MISSING |
| `FASHION_KNOWLEDGE_LLM_BASE_URL` | endpoint override | OPTIONAL | shared base | shared fallback | MISSING |
| `FASHION_KNOWLEDGE_LLM_TIMEOUT_MS` | timeout | OPTIONAL | 15000 | timeout | DEFAULT |
| `FASHION_KNOWLEDGE_LLM_MAX_RETRIES` | retries | OPTIONAL | 1 | bounded retry | DEFAULT |
| `FASHION_KNOWLEDGE_LLM_TEMPERATURE` | sampling | OPTIONAL | 0.2 | output variance | DEFAULT |
| `FASHION_KNOWLEDGE_LLM_MAX_OUTPUT_TOKENS` | output cap | OPTIONAL | 1200 | truncation | DEFAULT |
| `FASHION_KNOWLEDGE_REGISTRY_ENABLED` | Mode A registry | OPTIONAL | false | feature off | MISSING |
| `FASHION_KNOWLEDGE_ACCESSORIES_ENABLED` | accessory module | OPTIONAL | false | feature off | MISSING |
| `FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED` | silhouette module | OPTIONAL | false | feature off | MISSING |
| `FASHION_KNOWLEDGE_CULTURAL_CONTEXT_ENABLED` | cultural module | OPTIONAL | false | feature off | MISSING |
| `FASHION_KNOWLEDGE_TELEMETRY_ENABLED` | consent telemetry | OPTIONAL | false | telemetry off | BLUEPRINT false |
| `FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED` | legacy bypass | DEPRECATED | false | false is safe | MISSING / safe |
| `BEAUTY_TRYON_ENABLED` | live try-on | OPTIONAL | false | disabled | BLUEPRINT false |
| `BEAUTY_TRYON_PROVIDER` | try-on adapter | OPTIONAL | none | startup fatal if enabled without adapter | MISSING / NOT_APPLICABLE |
| `MIRA_SUBSCRIPTIONS_ENABLED` | server/client commerce | OPTIONAL | false | limits/payment off | MISSING_FROM_BLUEPRINT |

Flutter release dart-defines (all values remain build-time, not secrets):
`USE_MIRA_API`, `MIRA_API_BASE_URL`, `MIRA_SUBSCRIPTIONS_ENABLED`,
`MIRA_STORE_KIT_ENABLED`, `MIRA_PACKAGES_ENABLED`,
`MIRA_MARKETPLACE_ENABLED`, `MIRA_FASHION_ADVISOR_V1`,
`MIRA_FACE_CAPTURE_MIRROR_V1`, `MIRA_FACE_ANALYSIS_MOTION_V1`,
`MIRA_FACE_RESULT_MIRROR_V1`, `MIRA_RESULTS_EXPERIENCE_V2`,
`MIRA_DELIGHT_UI`, `MIRA_PUBLIC_SITE_URL`,
`MIRA_ENTITLEMENT_LOCAL_QA_OVERRIDE`. Defaults are fail-closed except
`USE_MIRA_API=true` and the API/public URL defaults.

Test/debug-only variables: `AT4_LIVE_PROVIDER`, `FACE_SMOKE_BASE_URL`,
`PHASE21_PERF_FAIL`, `FASHION_TELEMETRY_LOG`, `BEAUTY_TELEMETRY_LOG`.
