# Analysis Orchestration (Phase 1)

## SkinAnalysisOrchestrator

Location: `mira-api/src/ports/orchestrators/skin-analysis.orchestrator.ts`

Responsibilities:

1. Validate image input
2. Select SkinAnalysisPort adapter (perfect vs mock) via typed config
3. Enforce Phase 0: no mock in production, no display of mock as real
4. Timeout boundary (`SKIN_PROVIDER_TIMEOUT_MS`)
5. Map `ProviderPortError` → Nest HTTP exceptions (safe client payload)
6. Emit telemetry events (noop adapter by default)
7. Return normalized `SkinAnalysisPortResult` + legacy internal shape for Intelligence

Persistence and MiraBeautyReport building remain in `SkinAnalysisService` (handoff).

## FashionAnalysisOrchestrator

Location: `mira-api/src/ports/orchestrators/fashion-analysis.orchestrator.ts`

Responsibilities:

1. Reject legacy outfit mock as canonical provider
2. Call VisionFashionAdapter (FASHN + OpenAI via VisionOrchestratorService)
3. Timeout boundary (`FASHION_PROVIDER_TIMEOUT_MS`)
4. Preserve Flutter response contract (`fashionVision` + `meta`)
5. Telemetry + typed errors

## Not in Phase 1

- FaceAnalysisOrchestrator
- TryOnOrchestrator (only disabled BeautyTryOnPort)
- Changing Skin Vitality Index formula
