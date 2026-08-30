# PROD-RC-1 — Runtime Flag Architecture

## Client Face / Fashion

| Flag | Mechanism | Default |
|---|---|---|
| `MIRA_FACE_CAPTURE_MIRROR_V1` | `bool.fromEnvironment` compile-time | false |
| `MIRA_FACE_ANALYSIS_MOTION_V1` | compile-time | false |
| `MIRA_FACE_RESULT_MIRROR_V1` | compile-time | false |
| `MIRA_FASHION_ADVISOR_V1` | compile-time | false |

## Existing runtime pattern (not Face/Fashion)

`MiraResultsExperienceFlagStore` — process-local store with `apply` / `fromConfigValue` (Results V2). Demonstrates project pattern for runtime kill switch.

## Server Fashion

Env flags (runtime), including:

- `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED`
- `FASHION_KNOWLEDGE_LLM_ENABLED`
- `FASHION_KNOWLEDGE_TELEMETRY_ENABLED` (must stay false)
- domain flags (registry/accessories/form/cultural) — keep OFF until scenario-required
- `FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED` — OFF

Server Fashion can be killed by env without new binary.

## Gap

Face/Fashion **client** paths lack remote/master runtime OFF after a binary ships with dart-defines true.
