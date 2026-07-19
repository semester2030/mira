# State Management Boundaries (Phase 1)

Audit summary — **no full migration** in Phase 1.

## Observed patterns

| Area | Pattern | Rule |
|------|---------|------|
| Skin / outfit capture screens | StatefulWidget + services | UI must not call Perfect/FASHN/OpenAI directly |
| Intelligence reports | Entity mappers + widgets | UI displays DTOs only; no provider schema parsing |
| Outfit intelligence | Domain services (`OutfitIntelligenceService`) | Orchestration stays in domain/API, not widgets |
| Riverpod / Bloc | Mixed / sparse in places | Do not introduce a second competing store for the same feature |

## What UI may do

- Render `MiraBeautyReport` / `FashionVisionDocument` fields
- Show provenance, disclaimer, confidence when present
- Trigger analysis via repository/datasource

## What UI must not do

- Import Nest provider DTOs or raw YouCam/FASHN/OpenAI JSON shapes
- Invent scores, fill missing metrics, or silent-fallback mocks
- Calculate Skin Vitality Index (engine/API owns it)
- Enable beauty try-on locally without server capability

## Domain orchestration home

- **Server:** `SkinAnalysisOrchestrator`, `FashionAnalysisOrchestrator`
- **Client domain:** repositories + `OutfitIntelligenceService` for local post-processing only

Phase 1 did not refactor unrelated screens.
