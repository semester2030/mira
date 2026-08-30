# Phase 9A — Current Face Pipeline

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — Face Analysis Experience Discovery + Architecture Lock  
**Mode:** READ ONLY · NO IMPLEMENTATION  
**Date:** 2026-08-11  
**Verdict context:** Face Intelligence v1.0.0 frozen · Skin Intelligence v1.0.0 frozen · consume-only


```
User → AnalysisNavigation.openSkinAnalysis
  → NewAnalysisScreen
  → FaceCapturePanel (front camera, mirrored preview)
  → LiveFaceAnalysisOverlay + FaceMeshService (MediaPipe)
  → FaceMeshQualityGate.canTakePhoto (enables shutter)
  → Manual capture
  → FaceGateValidator + ImageQualityEvaluator (+ mesh gate)
  → FaceIntelProductionBridge → faceIntel JSON
  → POST /api/v1/ai/skin-analysis (multipart image + faceIntel)
  → Server image quality + BlazeFace gate
  → Perfect Corp skin analysis (sibling)
  → runFaceReportPipeline (API Face Intel)
  → MiraBeautyReport { skin…, faceIntelligence?, faceIntelligenceRuntime? }
  → ResultsReportEntry
       default → MiraBeautyReportScreen (long scroll)
       MIRA_RESULTS_EXPERIENCE_V2 → ResultsExecutiveSummaryScreen…
```

| Edge | Classification |
|------|----------------|
| Camera capture | LIVE |
| MediaPipe guidance | LIVE |
| Auto-capture | NOT_FOUND |
| faceIntel upload | LIVE |
| Face report pipeline | LIVE |
| Dedicated face HTTP API | NOT_FOUND |
| Multi-angle | NOT_FOUND |
| Client Face*Pipeline prod | TEST_ONLY (gated) |
