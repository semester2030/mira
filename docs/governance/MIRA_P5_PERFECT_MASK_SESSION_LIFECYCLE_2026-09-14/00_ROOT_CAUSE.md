# MIRA-P5-PERFECT-MASK-SESSION-LIFECYCLE-2026-09-14

## Proven device evidence (before fix)
HUD on physical iPhone:
- pore → hd_pore: **NO_SESSION bytes=0**
- wrinkle / moisture / dark_circle: **NO_SESSION bytes=0**

Breakpoint = SESSION LIFECYCLE / PROPAGATION (not ColorFilter, not layer order, not UI).

## Exact root cause
1. **Face Explorer re-read a cleared static on every rebuild**  
   `SkinInteractiveReportScreen` passed `maskSession: AnalysisSession.lastPerfectMasks` in `build()`.
2. **Result dispose wiped the shared session**  
   `_releaseEphemeralFace()` called `AnalysisSession.setPerfectMasks(null)`, which **disposed** the session map (bytes cleared for any remaining holder).
3. Combined: metric tap → parent `setState` → rebuild → `lastPerfectMasks == null` → HUD `NO_SESSION`.

Canonical create path was already:
`SkinAnalysisApiDataSource._parseResponse` → `PerfectMaskSession.fromApiPayload` → `AnalysisSession.setPerfectMasks`.

## Fix (lifecycle only)
1. Propagate the same session on the result route: `MiraReportRouteArgs.perfectMaskSession`.
2. Bind once in `SkinInteractiveReportScreen.initState` → `_boundMaskSession` (stable across rebuild/scroll/hold).
3. Pass `_boundMaskSession` to Face Explorer (never re-read a cleared static).
4. On leave: `detachPerfectMasksIfCurrent` (drop owner pointer, **no dispose** of bytes).
5. Dispose previous session only when a **new analysis** replaces it via `setPerfectMasks`.

## Ownership
| Role | Symbol |
|---|---|
| SESSION CREATED AT | `SkinAnalysisApiDataSource._parseResponse` → `PerfectMaskSession.fromApiPayload` → `AnalysisSession.setPerfectMasks` |
| SESSION OWNED BY | `AnalysisSession.lastPerfectMasks` (ONE) |
| PASSED TO FACE EXPLORER | `MiraReportNavigation.openAfterAnalysis` → `MiraReportRouteArgs.perfectMaskSession` → `ResultsReportEntry` → `SkinInteractiveReportScreen._boundMaskSession` → `ResultsSkinMapPanel.maskSession` |
| DETACHED AT | `SkinInteractiveReportScreen._releaseEphemeralFace` → `AnalysisSession.detachPerfectMasksIfCurrent` |
| DISPOSED AT | Next `AnalysisSession.setPerfectMasks` (new analysis) or `AnalysisSession.clear` |

## Not modified
Apple Matte, black BG, ColorFilter, PerfectMaskOverlay presentation, Perfect API, capture, carousel layout, scores, backend.
