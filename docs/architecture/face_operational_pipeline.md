# Face Operational Pipeline (Operational Hardening)

## Single production execution path

```
Camera (FaceCapturePanel)
  → Capture file
  → SkinCaptureQualityGate (quality + FaceGate + align)
  → FaceIntelProductionBridge (MediaPipe anchors OR explicit FAILED/UNAVAILABLE)
  → multipart image + faceIntel (always includes runtime)
  → POST /ai/skin-analysis
  → parseFaceIntelPackage
  → IntelligenceService.buildBeautyReport
       → runFaceReportPipeline  // ONCE: Foundation→Geometry→Features→Recos→Report
  → MiraBeautyReport.faceIntelligence (+ faceIntelligenceRuntime)
  → Flutter MiraBeautyReportMapper
  → FaceIntelligenceSection | FaceIntelRuntimeNotice
```

## Ownership

| Concern | Owner |
|---------|--------|
| Production Face Report | API `runFaceReportPipeline` |
| On-device anchors | Flutter `GeometryAnchorExtractor` + `FaceMeshService` |
| Runtime states | Shared wire `FaceIntelRuntimeState` / DTO |
| Flutter Face*Pipeline mirrors | Testing / Future offline only (`FaceClientMirrorGate`) |

## No silent omission

Every skin-analysis request that reaches Face Intel upload emits `runtime.status` ∈  
`AVAILABLE | UNAVAILABLE | FAILED | SKIPPED | NOT_REQUESTED`.
