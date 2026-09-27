# Lighting override — justified by physical iPhone session 80179

## Evidence (after VideoRange→FullRange + auto-exposure)

Repeated physical callbacks:
```
area=good pose=good light=under_exposed code=lighting_low ready=false
```
Never observed `ready=true` in that session.
Also observed `light=normal` while `area=too_small` (lighting gate can pass; floor still too strict when face fills frame).

## Override applied

| Parameter | Before (MODERATE) | After |
|---|---|---|
| lightingLower | 0.70 | **0.65** |
| lightingUpper | 0.85 | 0.85 (unchanged) |
| faceSizeRatio | 0.65 | unchanged |
| faceYaw | 10 | unchanged |
| facePitch | -15..+5 | unchanged |

Method: `setCameraKitLevel(.moderate)` then `setCameraKitOverwrite` with builder `setLightingLower(0.65)` only.
SDK allowed range for lightingLower: 0.55…1.0.
NOT switched to RELAXED.
