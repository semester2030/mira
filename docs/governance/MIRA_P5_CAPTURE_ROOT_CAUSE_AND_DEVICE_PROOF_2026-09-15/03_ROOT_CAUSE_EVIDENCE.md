# 03 — ROOT CAUSE EVIDENCE

## Hypothesis matrix

| ID | Claim | Test | Result | Classification |
|---|---|---|---|---|
| H1 | CameraKit not initialized | Init log | `version=2.5.0… yaw=10 size=0.65` | REJECTED |
| H2 | Frames not reaching SDK | Quality callbacks | Hundreds of events with changing area/pose | REJECTED |
| H3 | MediaPipe still final gate | Code `_mirrorEnabled => !_cameraKitActive` | CameraKit owns gate when active | REJECTED as final gate |
| H4 | takePicture fails | Would need READY first | Never reached in 80179 | N/A |
| H5 | READY blocked solely by lighting when face OK | Count combos | 65× good/good all under_exposed; ready_true=0 | **VERIFIED ROOT** |
| H6 | VideoRange→FullRange causes under_exposed | A/B with/without expand | Not isolated; expand present in 80179 and under_exposed persisted | HYPOTHESIS (unproven) |
| H7 | HUD size alone blocks capture | area=good occurred 65× | Size gate can pass | REJECTED as sole cause |
| H8 | deg=0.0 blocks capture | Code path | Degree not used in ready | REJECTED |

## Evidence artifact

`logs/80179_quality_summary.txt`

## Stop point in code

1. `PerfectCameraKitOwner.cameraKit(_:checkedResult:)` sets `ready=false` when lighting is under_exposed.
2. `FaceCapturePanel._canTakePhoto` → false.
3. `_onCameraKitQuality` never sees `isStableReady`.
4. `_capture` never calls `takePicture`.

## Fix applied after proof

`applyIndoorLightingLowerOverride`: `lightingLower = 0.55` (SDK-documented RELAXED lighting floor), after `setCameraKitLevel(.moderate)` so pose/size remain MODERATE.
