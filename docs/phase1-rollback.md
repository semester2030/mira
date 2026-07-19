# Phase 1 Rollback

## What Phase 1 added

- `mira-api/src/ports/**` (ports, adapters, orchestrators, config)
- Wiring: `SkinAnalysisService` → `SkinAnalysisOrchestrator`
- Wiring: Vision analyze → `FashionAnalysisOrchestrator`
- `PortsModule` in `AppModule`
- CI workflow `.github/workflows/mira-ci.yml`
- Docs under `docs/architecture/` and `docs/deployment/phase1-environment.md`

## Rollback steps

1. Revert Phase 1 commits (keep Phase 0 files intact).
2. Ensure `SkinAnalysisService` again injects `SKIN_ANALYSIS_PROVIDER` if fully reverting orchestrator.
3. Ensure `AiGatewayController.analyzeVisionOutfit` calls `VisionOrchestratorService` directly if reverting fashion orchestrator.
4. Remove `PortsModule` from `AppModule` if reverting.
5. Redeploy `mira-api`.
6. Confirm Phase 0 gates still pass: `npm run test:phase0-integrity`.

## Do not rollback Phase 0

Never re-enable `PERFECT_CORP_FALLBACK_MOCK=true` in production as part of a Phase 1 rollback.
