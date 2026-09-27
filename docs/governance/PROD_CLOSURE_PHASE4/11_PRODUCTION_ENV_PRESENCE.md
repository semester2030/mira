# Production Environment Presence

## CONFIG evidence — values intentionally omitted

Required and present:

- `DATABASE_URL`, `REDIS_URL`
- `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`
- `PERFECT_API_KEY`, `FASHN_API_KEY`, `LLM_API_KEY`
- `NODE_ENV`, `SKIN_PROVIDER`

Present provider configuration:

- `PERFECT_BASE_URL`, `FASHN_BASE_URL`
- `LLM_BASE_URL`, `LLM_MODEL`

Safe production controls:

- `AUTH_SKIP = OFF`
- `PARTNER_AUTO_APPROVE = OFF`
- `PERFECT_CORP_FALLBACK_MOCK = OFF`
- legacy outfit override absent/default-safe
- Face/Fashion masters absent/default `OFF`
- internal UID allowlist absent/default empty
- Fashion Knowledge telemetry/integration flags absent/default `OFF`

Result: `REQUIRED_ENV = PASS`. No value was printed or stored.
