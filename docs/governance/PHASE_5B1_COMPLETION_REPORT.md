# Phase 5B.1 — Provider Simulation & Integration Readiness

**Status:** DONE · Integration Ready · Provider Execution Disabled  
**Release:** `0.2.0-integration`  
**Date:** 2026-07-19  
**Portal:** `docs/mira-production-transformation-program.html#phase5b1-report`

## Mission

Build the complete production Beauty Experience flow **without** a licensed provider.

When a provider is activated later:

- **NO** Flutter code changes
- **NO** architecture changes
- **NO** session / DTO changes
- **ONLY** provider activation (flags + readiness checklist + adapter wiring)

## What was built

| Surface | Location | Notes |
|---------|----------|-------|
| Canonical Try-On DTO | `dto/canonical.dto.ts` | `resultAssetUrl: null` when blocked |
| Look / Favorite / Collection / Share DTOs | same | No provider fields |
| Session attempts + look lifecycle | `session/` + adapter | Mira-owned |
| History | `history/` + `history()` | Per-user session index |
| Compare | `comparison/` + `compare()` | ≥2 attempts |
| Runtime states + retry | `runtime/beauty-runtime-state.ts` | Incl. `BLOCKED_BY_CONFIGURATION` |
| Feature flags | `integration/feature-flags.ts` | Env-driven; execution gated |
| Telemetry / analytics | `integration/beauty-telemetry.ts` | No images / secrets / vendor payloads |
| Activation hooks | `integration/activation-hooks.ts` | No live calls |
| Capability placeholders | same | `providerExecutionEnabled: false` |
| Port surface | `BeautyExperiencePort` | Full integration API |

## Explicit non-goals (enforced)

- Do **not** connect Perfect Corp Makeup VTO
- Do **not** connect Banuba
- Do **not** install beauty SDKs
- Do **not** call external beauty APIs
- Do **not** fabricate try-on images or fake `success: true`

Unavailable capability → explainable **runtime state** (reason, stage, retryable).

## Feature flags (activation levers)

| Env | Default | Role |
|-----|---------|------|
| `BEAUTY_EXPERIENCE_ENABLED` | `true` | Subsystem |
| `BEAUTY_INTEGRATION_READY` | `true` | Session/history surface |
| `BEAUTY_REAL_TRYON_ENABLED` | `false` | Live try-on (stays false in 5B.1) |
| `BEAUTY_LIP_LICENSE_VERIFIED` | `false` | Operator license mark |
| `BEAUTY_TELEMETRY_ENABLED` | `true` | Analytics emit |

`isProviderExecutionAllowed` requires **all** gates. In 5B.1 this remains **false**.

## Tests

```bash
cd mira-api
npm run test:phase5b1
npm run test:phase5a
npm run test:phase5a5
npm run test:phase5b0
```

## Health

`GET /health` → `intelligence.beautyExperience.integration`

## Activation path (future — not this phase)

1. Complete Provider Readiness checklist (5B.0)
2. Verify Perfect lip license evidence
3. Set `BEAUTY_LIP_LICENSE_VERIFIED=true` + `BEAUTY_REAL_TRYON_ENABLED=true`
4. Wire live adapter behind existing `ProviderManager` / activation hooks
5. **No** Flutter / session / canonical DTO redesign

## Stop line

**Phase 5B.1 complete. Do not start Phase 5C.**
