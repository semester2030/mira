# Phase 9A — Repository Discovery

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — Face Analysis Experience Discovery + Architecture Lock  
**Mode:** READ ONLY · NO IMPLEMENTATION  
**Date:** 2026-08-11  
**Verdict context:** Face Intelligence v1.0.0 frozen · Skin Intelligence v1.0.0 frozen · consume-only


## Flutter (selected)
| Path | Role | Class |
|------|------|-------|
| `lib/features/dashboard/presentation/screens/new_analysis_screen.dart` | Live capture host | LIVE |
| `lib/features/skin_analysis/presentation/widgets/face_capture_panel.dart` | Camera + gates + upload trigger | LIVE |
| `lib/.../live_face_map/face_mesh_service.dart` | MediaPipe mesh | LIVE |
| `lib/.../live_face_map/face_mesh_quality_gate.dart` | Distance/center/quality | LIVE |
| `lib/core/face_gate/face_gate_validator.dart` | ML Kit pose/area | LIVE |
| `lib/.../domain/image_quality/image_quality_evaluator.dart` | Blur/brightness | LIVE |
| `lib/features/face_intelligence/data/face_intel_production_bridge.dart` | Upload bundle | LIVE |
| `lib/features/intelligence/presentation/screens/mira_beauty_report_screen.dart` | Default result | LIVE |
| `lib/.../widgets/face_intelligence_section.dart` | Face Intel UI | LIVE |
| `lib/.../beauty_report_face_map/*` | Skin map painters | LIVE illustrative |
| `lib/features/results_experience/**` | Results v2 | PARTIAL flag |
| `lib/.../widgets/face_guide_overlay.dart` | Unused guide | NOT_FOUND wired |
| `lib/.../widgets/ai_analysis_overlay.dart` | Unused YouCam-style | NOT_FOUND wired |
| `lib/features/face_intelligence/domain/*Pipeline` | Client mirrors | TEST_ONLY |

## Nest (selected)
| Path | Role | Class |
|------|------|-------|
| `mira-api/src/ai/ai-gateway.controller.ts` | `POST ai/skin-analysis` | LIVE |
| `mira-api/src/skin-analysis/skin-analysis.service.ts` | Orchestrates skin+face | LIVE |
| `mira-api/src/intelligence/intelligence.service.ts` | `buildBeautyReport` | LIVE |
| `mira-api/src/intelligence/face-intelligence/report.pipeline.ts` | `runFaceReportPipeline` | LIVE |
| `mira-api/src/intelligence/face-intelligence/geometry/face-geometry.engine.ts` | Metrics | LIVE |
| `mira-api/src/intelligence/face-intelligence/features/face-shape.classifier.ts` | Shape | LIVE |
| `mira-api/src/intelligence/face-intelligence/recommendation/face-recommendation.engine.ts` | Recos | LIVE |
| `mira-api/src/ai/face-gate/face-gate.service.ts` | Server BlazeFace | WIRED |

## Governance
`docs/governance/FACE_INTELLIGENCE_PRODUCTION_FREEZE_v1.0.0.md`, ADR-FI-001…007, `docs/architecture/face_production_pipeline.md`, `docs/contracts/face_*.md`
