# PHASE 9F — Result Entry Audit

## Current production (flag OFF)
```
NewAnalysisScreen success
→ MiraReportNavigation.openAfterAnalysis
→ ResultsReportEntry
→ MiraBeautyReportScreen (default) OR ResultsExecutiveSummaryScreen (V2)
→ FaceIntelligenceSection (legacy long report only)
```

## 9F path (flag ON + fresh)
```
NewAnalysisScreen
→ prepare FaceResultMirrorImageHold
→ analyze (original temp deleted)
→ 9D handoff if motion ON
→ openAfterAnalysis(captureImagePath, fromFreshAnalysis: true)
→ ResultsReportEntry
→ ResultsFaceMirrorScreen
→ FaceResultProjector.project(faceIntelligence)  // 9E VMs
→ Interactive Result Mirror UI
```

9E projection is the presentation truth — UI does not re-read raw Face Intel fields when VMs exist (screen projects once into VMs then binds widgets to VMs).
