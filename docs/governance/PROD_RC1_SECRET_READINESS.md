# PROD-RC-1 — Secret Readiness

**Rule:** names + classification only · **no values printed**

## Local `mira-api/.env` (names)

| Key | Classification |
|---|---|
| DATABASE_URL | PRESENT |
| PERFECT_CORP_API_KEY | PRESENT |
| FASHN_API_KEY | PRESENT |
| FIREBASE_PROJECT_ID | PRESENT (value emptiness not re-printed; Admin pieces below) |
| FIREBASE_CLIENT_EMAIL | **MISSING** |
| FIREBASE_PRIVATE_KEY | **MISSING** |
| ADMIN_API_KEY | PRESENT |
| REDIS_URL | PRESENT |
| LLM_API_KEY | **MISSING** |
| LLM_BASE_URL | **MISSING** |
| LLM_MODEL | **MISSING** |
| OPENAI_API_KEY | **MISSING** |
| FASHION_KNOWLEDGE_* flags | **MISSING** (defaults OFF in code) |
| SKIN_PROVIDER / OUTFIT_PROVIDER | PRESENT |

## Face server needs (hosted QA/prod)

| Concern | Classification |
|---|---|
| Database | PRESENT locally; prod unknown while suspended |
| Firebase Admin for real auth | **MISSING** local Admin fields |
| Perfect Corp / skin analysis | PRESENT local key name |
| Image storage | NEEDS CONFIRMATION on hosted env |
| Auth | AUTH_SKIP present locally (dev only) |

## Fashion Mode B

| Key | Classification |
|---|---|
| LLM_API_KEY | **MISSING** locally · required for live Mode B |
| LLM_BASE_URL / LLM_MODEL | **MISSING** locally (example defaults exist) |
| FASHION_KNOWLEDGE_LLM_* overrides | NOT_REQUIRED if LLM_* set |
| Telemetry | Must remain **false** |

## Blueprint (`render.yaml`)

`LLM_API_KEY`, `PERFECT_API_KEY`, Firebase, ADMIN, CORS marked `sync: false` — must be set in Dashboard; **cannot verify** while service suspended / no MCP.
