# PROD-FINAL-1 — Secret Readiness

Values never printed.

| Key | Needed for | Local | Production |
|---|---|---|---|
| DATABASE_URL | platform | PRESENT | UNKNOWN (suspended) |
| Firebase Admin | auth | PARTIAL/MISSING pieces | UNKNOWN |
| Perfect Corp | Face/Skin | PRESENT local | UNKNOWN |
| LLM_API_KEY | Fashion Mode B | MISSING local | UNKNOWN |
| LLM_BASE_URL / LLM_MODEL | Fashion | MISSING local | blueprint defaults exist |
| MIRA_PRODUCTION_INTERNAL_UIDS | allowlist | N/A | **MUST SET** (sync:false) |
| MIRA_FACE_EXPERIENCE_MASTER_ENABLED | canary | N/A | default false |
| MIRA_FASHION_MODE_B_MASTER_ENABLED | canary | N/A | default false |
| FASHION_KNOWLEDGE_TELEMETRY_ENABLED | telemetry | — | must false |

**PAUSE for owner to enter production secrets in Render Dashboard.**
