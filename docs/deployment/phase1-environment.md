# Phase 1 Environment Variables

## Required / recommended on Render (`mira-api`)

| Key | Production value | Notes |
|-----|------------------|--------|
| `NODE_ENV` | `production` | |
| `SKIN_PROVIDER` | `perfect_corp` | Fatal if `mock` in prod |
| `PERFECT_CORP_FALLBACK_MOCK` | `false` | Phase 0 gate |
| `MOCK_PROVIDER_ACCESS` | `false` | Phase 1 gate |
| `FASHION_PROVIDER` | `vision_platform` | Canonical fashion |
| `BEAUTY_TRYON_ENABLED` | `false` | Until Phase 5 adapter |
| `OUTFIT_PROVIDER` | `mock` (legacy) | Blocked for live results; not canonical |
| `SKIN_PROVIDER_TIMEOUT_MS` | `90000` | Optional |
| `FASHION_PROVIDER_TIMEOUT_MS` | `90000` | Optional |

## Startup behavior

`main.ts` calls:

1. `assertProductionIntegrity` (Phase 0)
2. `assertProviderPortsConfig` (Phase 1)

Unsafe combinations fail process start.

## Compatibility

Existing Perfect/FASHN/OpenAI keys unchanged. Blueprint updated in `render.yaml`.
