# Lifecycle before / after

## BEFORE
```
API ephemeralMasks
 → AnalysisSession.setPerfectMasks(session)
 → navigate result
 → build(): maskSession = AnalysisSession.lastPerfectMasks   // re-read every rebuild
 → dispose/pop (or stacked route): setPerfectMasks(null) + dispose()  // wipes bytes
 → setState(metric tap): build() sees null → NO_SESSION bytes=0
```

## AFTER
```
API ephemeralMasks
 → AnalysisSession.setPerfectMasks(session)
 → MiraReportRouteArgs.perfectMaskSession = same session
 → initState: _boundMaskSession = args ?? owner
 → build(): maskSession = _boundMaskSession   // stable
 → metric tap / scroll / rebuild: same session
 → leave: detachPerfectMasksIfCurrent (pointer only)
 → new analysis: setPerfectMasks(new) disposes previous
```

## Required HUD after fix (valid HD analysis)
```
SESSION_READY bytes=<positive>
```
NO_SESSION must be 0 for a completed analysis that returned ephemeralMasks.
