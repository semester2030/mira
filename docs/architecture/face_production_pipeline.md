# Face Intelligence — Production Pipeline (Phase 4.5)

## Status

**Canonical.** Face Intelligence libraries (4A–4F) execute on the live skin-analysis path.

## Ownership

| Stage | Owner | Location |
|-------|--------|----------|
| Capture + FaceGate | Flutter | `FaceGateValidator`, `cq-thresholds-v2.1` |
| Image quality | Flutter + API | `SkinCaptureQualityGate`, `ImageQualityPort` |
| Landmarks → anchors | Flutter (once) | `FaceMeshService.extractFaceIntelLandmarks` → `GeometryAnchorExtractor` |
| Upload payload | Flutter | `FaceIntelUploadPayload` / `FaceIntelProductionBridge` |
| Multipart field | Flutter → API | `faceIntel` JSON on `POST /ai/skin-analysis` |
| Parse / sanitize | API | `parseFaceIntelInput` |
| Foundation → Report | API (once) | `runFaceReportPipeline` via `IntelligenceService.buildBeautyReport` |
| Persist / DTO | API | `MiraBeautyReport.faceIntelligence` |
| Deserialize / UI | Flutter | `MiraBeautyReportMapper` → `FaceIntelligenceSection` |

## Canonical execution flow

```
Capture
  → Quality (SkinCaptureQualityGate)
  → Eligibility signals (pose from FaceGate)
  → Landmarks (MediaPipe normalized 0–1 — not viewport debugLandmarks)
  → GeometryAnchors (GeometryAnchorExtractor)
  → multipart: image + faceIntel
  → SkinAnalysisService.analyze(..., faceIntel)
  → parseFaceIntelInput (omit if invalid — never invent)
  → IntelligenceService.buildBeautyReport({ faceIntel })
  → runFaceReportPipeline  // Foundation→Geometry→Features→Recos→Report — once
  → MiraBeautyReport.faceIntelligence
  → stored resultJson + SkinAnalysisResponseDto
  → MiraBeautyReportMapper.fromJson
  → FaceIntelligenceSection (when non-null)
```

## Rules

- **One Face Report pipeline execution** per beauty report build (`IntelligenceService`).
- **One anchor extraction** per upload (quality gate). Retries reuse the same `faceIntelJson`.
- **No parallel report builders** on Flutter for production (API owns report DTO).
- **No viewport landmarks** for geometry — only MediaPipe normalized coords.
- When `faceIntel` absent/invalid → `faceIntelligence` remains **undefined** (section hidden).
- When pose present but anchors missing → pipeline still runs; geometry/shape mark **unavailable**.

## Non-goals (Phase 4.5)

- No algorithm / geometry / shape / recommendation / UI redesign.
- No new engines.
- No merging with FaceHealthMap (see `face_health_map_relationship.md`).
