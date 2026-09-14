# Runtime path (exact)

```
iPhone capture
→ NewAnalysisScreen / SkinAnalysisBloc
→ SkinAnalysisRepositoryImpl.analyzeAndSave
→ SkinAnalysisApiDataSource.analyzeAndSave
→ POST /ai/skin-analysis  (MiraApiEndpoints.skinAnalysis)
→ AiGatewayController.analyzeSkin
→ SkinAnalysisService.analyze
→ SkinAnalysisOrchestrator → PerfectCorpSkinAdapter
→ PerfectCorpSkinProvider.analyzeHdVariant  [SURGICAL — was missing on main]
   → PerfectCorpService.analyzeSkinHdMasks (ONE HD task)
   → parsePerfectHdMaskPayload
   → materializeHdMaskArtifacts
→ SkinAnalysisResponseDto.from(..., ephemeralMasks)
→ Flutter _parseResponse
→ PerfectMaskSession.fromApiPayload
→ AnalysisSession.setPerfectMasks + recordMaskCreateProof
→ MiraReportNavigation → SkinInteractiveReportScreen._boundMaskSession
→ ResultsSkinMapPanel (Face Explorer)
```

Perfect task count per user analysis (HD contract): **1**
