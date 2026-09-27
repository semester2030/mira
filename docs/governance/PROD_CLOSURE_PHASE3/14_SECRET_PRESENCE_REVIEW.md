# Phase 3 — Secret Presence Review

Method: names, code readers, Blueprint declarations and boolean runtime health
only. No secret values were read into evidence or reproduced.

| Secret/config | Required for | Source declaration | Runtime presence |
|---|---|---|---|
| `DATABASE_URL` | Postgres | generated from Render DB | PRESENT, inferred from DB-backed 200 |
| `PERFECT_API_KEY` | Skin | `sync:false` | PRESENT boolean in live health |
| `FIREBASE_PROJECT_ID` | token verification | `sync:false` | PRESENT, inferred from invalid-token verification path |
| `GOOGLE_APPLICATION_CREDENTIALS` / ADC | privileged Admin operations | `sync:false` | UNKNOWN |
| `LLM_API_KEY` | OpenAI paths | `sync:false` | UNKNOWN |
| `FASHN_API_KEY` | FASHN paths | `sync:false` | UNKNOWN |
| `FASHN_BASE_URL` | FASHN paths | `sync:false` | UNKNOWN |
| `ADMIN_API_KEY` | admin portal | `sync:false` | UNKNOWN |
| `MIRA_PRODUCTION_INTERNAL_UIDS` | canary entitlements | `sync:false` | UNKNOWN |
| `REDIS_URL` | limits/cache | absent from Blueprint | UNKNOWN live / MISSING_FROM_BLUEPRINT |
| `WEBSITE_CORS_ORIGINS` | static portals | `sync:false` | UNKNOWN |

Confirmed missing required secret values: `0`. Required/sensitive values whose
live presence is unknown: `8` if the FASHN base URL and CORS are treated as
configuration rather than secrets; confirmed missing secure-launch
infrastructure declaration: Redis.

Public Firebase client API identifiers committed in `firebase_options.dart`
are expected mobile client configuration, not Admin credentials.

`docs/governance/PRODUCTION_SECRET_INJECTION.md` is the approved injection
runbook. Secrets must be entered directly in provider/Render consoles, never in
chat, commits, screenshots or audit archives.
