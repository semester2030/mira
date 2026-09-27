# 04 — ROOT CAUSE EVIDENCE

## A. Config reset after overwrite (VERIFIED — SDK contract)

`PFCameraKit.h`: calling `setCameraKitLevel:` again resets overwrite presets.

Prior Dart path called `setLevel` after native initialize (which may have applied experimental overwrite).  
**This task:** single native `configureKit`; Dart does not call `setLevel` after initialize. Default `experimentalLightingLower=false`.

Device proof (`CKCFG-20260915B/C`):
```
FINAL_CONFIG … level=moderate … lightL=0.70 lightU=0.85 experimental=0 override=0
FIRST_FRAME_CONFIG … lightL=Optional(Optional(0.7)) …
```
SDK create logs Relaxed then Moderate internally; final snapshot remains MODERATE 0.70.

## B. Incorrect READY ∧ isValid (VERIFIED — sample + device)

Official sample (`CameraKitViewController.swift`):
```swift
func canCapture() -> Bool {
  return lightingQuality.isOk && faceAreaQuality.isOk && facePoseQuality.isOk
}
// lighting isOk := good || normal
```
**Does not use `isValid`.**

MIRA previously:
```swift
ready = faceAreaOk && facePoseOk && lightingOk && checkedResult.isValid
```

Device session B (`CKCFG-20260915B`, console):
- 111 quality events
- `valid_true=0`
- 7 events: area=good, pose=good, light=**normal**, valid=0, ready=0
- Counterfactual official canCapture on that log: **ready would be 7**

**Verifiable statement:**
«READY stayed false on good/good/normal frames because Mira ANDed `checkedResult.isValid` in `PerfectCameraKitChannel.cameraKit(_:checkedResult:)` while Perfect’s 2.5 sample `canCapture()` ignores `isValid`; session B log proves 7 such frames with valid=0.»

Fix shipped in `CKCFG-20260915C`: READY matches sample (still logs `valid=` for diagnosis).

## C. under_exposed mechanism (NOT VERIFIED)

Session B also had 55× good/good/under_exposed. Session C was dominated by too_small+under_exposed (user distance).  
meanY rose from ~43→160 with VideoRange→FullRange expand; pending≈1 (no backlog proof of stall).  
No A/B isolating convert vs real lighting vs AE. Keep UNKNOWN.

## D. Prior 80179 blocking condition

ready_true=0; 65× good/good all under_exposed; isValid missing from that Dart summary (gap closed in native/Dart logs now).
