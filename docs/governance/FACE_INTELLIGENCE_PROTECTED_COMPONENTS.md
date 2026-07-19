# Face Intelligence — Protected Components (v1.0.0)

Changing any item below requires a **formal Change Request** and major review (see Change Policy).

## Protected set

| Area | Paths / symbols |
|------|-----------------|
| Canonical Face Model | `canonical-face.model.ts`, Flutter `canonical_face_model.dart` (mirror) |
| Geometry formulas | `geometry/face-geometry.engine.ts`, `FACE_GEOMETRY_FORMULA_ID` |
| Geometry anchors schema | `geometry/geometry-anchors.ts` |
| Finding schema | `features/face-finding.engine.ts`, `docs/contracts/face_findings_contract.md` |
| Shape classifier | `features/face-shape.classifier.ts`, `FACE_SHAPE_FORMULA_ID` |
| Recommendation schema / engine | `recommendation/face-recommendation.engine.ts` |
| Report schema | `report/face-report.engine.ts`, `FaceIntelligenceReportDto` |
| Contracts | `docs/contracts/face_*.md`, `FACE_CONTRACT_VERSION` |
| Validation | `validation/*`, `FACE_VALIDATION_VERSION` |
| Golden reports | `validation/goldens/*`, report goldens |
| Snapshot / schema tests | `phase4a`…`phase4f`, `phase4_5`, operational e2e |
| Localization keys / bilingual fields | report AR/EN fields & auditors |
| Production pipeline | `*.pipeline.ts`, `runFaceReportPipeline` |
| DTOs on MiraBeautyReport | `faceIntelligence`, `faceIntelligenceRuntime` |
| Runtime states | `face-intel-runtime-state.ts` / Flutter equivalent |
| Capture quality coupling | `cq-thresholds-v2.1` reuse (do not fork silently) |
| Version manifest | `FACE_INTELLIGENCE_VERSION_MANIFEST.json` |

## Explicitly out of freeze scope (still governed by their own owners)

- Skin Intelligence / SVI  
- Perfect Corp skin provider adapters  
- Fashion / Vision / Phase 5+ program tracks  
- FaceHealthMap skin heatmap (sibling — do not merge)

## Accidental modification prevention

1. Treat this file as CODEOWNERS intent for Face Intel PRs.  
2. CI: `audit:face-eng-laws` + phase suites must stay green.  
3. Flutter Face*Pipeline mirrors must remain behind `FaceClientMirrorGate`.
