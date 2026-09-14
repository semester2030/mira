# Changed files

## Backend (canonical `/ai/skin-analysis` only)
- `mira-api/src/ai/mocks/perfect-corp-skin.provider.ts` — ONE HD variant + ephemeralMasks
- `mira-api/src/ai/services/perfect-corp.service.ts` — `analyzeSkinHdMasks` + `mapFromRawYouCam`
- `mira-api/src/ai/services/materialize-hd-masks.ts` — NEW (shared materializer)
- `mira-api/src/ai/services/perfect-hd-mask.parser.ts` — NEW
- `mira-api/src/ai/contracts/perfect-hd-mask.types.ts` — NEW
- `mira-api/src/ai/contracts/skin-analysis-provider-result.interface.ts` — ephemeralMasks field
- `mira-api/src/ports/adapters/perfect-corp-skin.adapter.ts` — pass `_ephemeralMasks`
- `mira-api/src/ports/skin/skin-analysis.port.ts` / orchestrator — propagate masks
- `mira-api/src/skin-analysis/dto/skin-analysis-response.dto.ts` — response field
- `mira-api/src/skin-analysis/skin-analysis.service.ts` — return + audit counts
- `mira-api/src/ai/ai.module.ts` / `ai-gateway.controller.ts` — HD acceptance service wiring (existing technical route)
- schema test: `skin-analysis-response-ephemeral-masks.schema-tests.ts`

## Flutter (create proof only — no renderer/UI redesign)
- `lib/core/session/analysis_session.dart` — `PerfectMaskCreateProof`
- `lib/features/skin_analysis/data/datasources/skin_analysis_api_data_source.dart` — record create proof
- `lib/features/skin_analysis/data/repositories/skin_analysis_repository_impl.dart` — guest skip proof
- `lib/features/results_experience/presentation/widgets/results_skin_map_panel.dart` — DIAG shows CREATE line
- `test/results_experience/perfect_mask_create_proof_test.dart`

## Duplication
NEW Perfect clients / session classes / renderers / state owners = **0**
ACTIVE DUPLICATE RESPONSIBILITIES = **0**
