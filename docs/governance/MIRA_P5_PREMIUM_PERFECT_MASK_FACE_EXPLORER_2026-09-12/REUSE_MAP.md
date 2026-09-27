# REUSE_MAP — MIRA-P5-PREMIUM-PERFECT-MASK-FACE-EXPLORER-2026-09-12

## Architecture decision

ONE Perfect HD task per Skin analysis → existing parser → existing Skin/intelligence scores → ephemeral masks in-memory → one Face Explorer (ResultsSkinMapPanel). No parallel Perfect client, parser, model tree, or state island.

## Ownership matrix

| Responsibility | Canonical Owner | Action | Active Duplicate Count | Verdict |
|---|---|---|---:|---|
| Perfect API client | `PerfectCorpService` | REUSE AS-IS | 0 | PASS |
| HD Skin analysis | `PerfectCorpService.analyzeSkinHdMasks` via `PerfectCorpSkinProvider` | EXTEND | 0 | PASS |
| Perfect result parser | `parsePerfectHdMaskPayload` + `mapYouCamResults` | EXTEND normalize HD→SD ids | 0 | PASS |
| Spatial concern model | `perfect-spatial-skin-concern.ts` + Flutter contract | REUSE | 0 | PASS |
| Mask retrieval | shared materialize helper (from acceptance download) | EXTEND | 0 | PASS |
| Mask lifecycle/cache | `PerfectMaskSession` (Flutter in-memory) | NEW — no prior mask owner | 0 | PASS |
| Skin result state | `SkinAnalysisBloc` + `SkinReport` | EXTEND | 0 | PASS |
| Selected metric state | `SkinInteractiveReportScreen._focusedConcernId` | EXTEND | 0 | PASS |
| Face Explorer renderer | `PerfectMaskOverlay` extracted for production | NEW shared primitive | 0 | PASS |
| Consumer Face Explorer UI | `ResultsSkinMapPanel` | REPLACE spatial layer | 0 | PASS |
| Landmark concern visualization | `LandmarkFaceRegionSession` + region chips | DEPRECATE consumer path | 0 | PASS |
| Design System | `AppColors` / `SkinFaceMapVisualTokens` | EXTEND | 0 | PASS |

## Call graph (production)

```
PerfectCorpService.analyzeSkinHdMasks
→ parsePerfectHdMaskPayload
→ materializeHdMaskArtifacts (download once)
→ mapYouCamResults (normalized types)
→ PerfectCorpSkinProvider / PerfectCorpSkinAdapter
→ SkinAnalysisOrchestrator
→ SkinAnalysisService.analyze (ephemeralMasks on response only; NOT in DB)
→ SkinAnalysisApiDataSource
→ PerfectMaskSession (decode once)
→ SkinInteractiveReportScreen (_focusedConcernId)
→ ResultsSkinMapPanel
→ PerfectMaskOverlay
```

## Deprecated for consumer Skin concern location

- Landmark explore chips (forehead / L-R cheek / nose / chin)
- Educational zone paint as spatial truth
- `SkinClaimPolicy.mapTruthVerdict = LANDMARK_TEMPLATE` → PROVIDER_PIXEL_MASK

Face Mesh capture infrastructure KEPT for non-concern features.
