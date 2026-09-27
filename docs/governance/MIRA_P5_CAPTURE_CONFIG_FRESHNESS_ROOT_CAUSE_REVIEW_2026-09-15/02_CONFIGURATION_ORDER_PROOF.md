# 02 — CONFIGURATION ORDER PROOF

## SDK contract (VERIFIED)

`ios/Vendor/PerfectCameraKit/Headers/PFCameraKit.h`:
> Calling `-setCameraKitLevel:` again resets the thresholds back to that level's preset values.

## Prior buggy sequence (CODE OBSERVATION)

Native initialize could apply overwrite, then Dart called `setLevel` → reset.

## Fixed sequence (CODE + DEVICE)

```
Dart initialize(level, experimentalLightingLower=false)
  → Native configureKit(setLevel → optional overwrite)
  → snapshot FINAL params returned (no second setLevel)
First sendFrame → FIRST_FRAME_CONFIG with same lightL
```

## Device FINAL values (CKCFG-20260915C)

```
level=moderate yaw=10.0 size=0.65 lightL=0.70 lightU=0.85 experimental=0 override=0
```

Note: SDK `CameraKit.create` logs Relaxed then Moderate during model load; Mira then applies requested level. Final snapshot is Moderate 0.70 — do not use an earlier setLevel log line as final proof.
