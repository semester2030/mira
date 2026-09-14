# Face remediation candidate — file classification

**Task:** authorize Face remediation commit  
**Date:** 2026-09-07

## FACE_REMEDIATION_REQUIRED

- `lib/core/utils/mira_api_error_message.dart`
- `lib/features/dashboard/presentation/screens/new_analysis_screen.dart`
- `lib/features/face_analysis_experience/presentation/analysis/analysis_motion.dart`
- `lib/features/face_analysis_experience/presentation/analysis/contracts/face_analysis_journey.dart`
- `lib/features/skin_analysis/data/datasources/skin_analysis_api_data_source.dart`
- `lib/features/skin_analysis/data/repositories/skin_analysis_repository_impl.dart`
- `lib/features/skin_analysis/domain/image_quality/quality_confidence_mapper.dart`
- `lib/features/skin_analysis/domain/repositories/skin_analysis_repository.dart`
- `lib/features/skin_analysis/presentation/blocs/skin_analysis_bloc.dart`
- `lib/features/skin_analysis/presentation/blocs/skin_analysis_state.dart`
- `lib/features/skin_analysis/presentation/live_face_map/widgets/live_face_analysis_overlay.dart`
- `mira-api/src/ai/face-gate/youcam-face-errors.ts`
- `mira-api/src/ai/face-gate/phase5-face-analysis-surgical.schema-tests.ts`
- `mira-api/src/ai/mocks/perfect-corp-skin.provider.ts`
- `mira-api/src/common/filters/http-exception.filter.ts`
- `mira-api/src/ports/adapters/perfect-corp-skin.adapter.ts`
- `mira-api/src/ports/orchestrators/fashion-analysis.orchestrator.ts`
- `mira-api/src/ports/orchestrators/skin-analysis.orchestrator.ts`
- `mira-api/src/ports/shared/provider-error.ts`
- `mira-api/src/skin-analysis/skin-analysis.service.ts`
- `test/face_analysis_experience/phase5_face_analysis_surgical_test.dart`
- `test/face_analysis_experience/phase5_image_lifecycle_test.dart`
- `docs/governance/PROD_CLOSURE_PHASE5/P5_FACE_ANALYSIS_FORENSIC_AUDIT.md`
- `docs/governance/PROD_CLOSURE_PHASE5/P5_FACE_ANALYSIS_SURGICAL_REMEDIATION.md`
- `docs/governance/PROD_CLOSURE_PHASE5/P5_FACE_PRODUCTION_DEVICE_CLOSURE.md`
- `docs/governance/PROD_CLOSURE_PHASE5/P5_FACE_CANDIDATE_COMMIT_FILE_CLASSIFICATION.md`

## EXCLUDE

- `docs/governance/PRODUCTION_CLOSURE_MASTER_ROADMAP/**` — historical roadmap noise
- `docs/governance/PROD_CLOSURE_PHASE2_FINAL/**`
- `docs/governance/PROD_CLOSURE_PHASE3/**` / `PHASE3B*` / `PHASE3C*`
- `docs/governance/PROD_CLOSURE_PHASE4/**`
- `docs/governance/PROD_CLOSURE_PHASE5/00_*.md`, `01_*.md`, `02_*.md` — Phase 5 entry/preflight, not Face surgical remediation
- `mira-api/scripts/lan-forward.py`
- `test/face_analysis_experience/failures/**` — golden failure artifacts
