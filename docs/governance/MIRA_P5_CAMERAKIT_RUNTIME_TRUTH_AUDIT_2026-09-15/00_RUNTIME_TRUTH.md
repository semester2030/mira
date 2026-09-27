# MIRA-P5-CAMERAKIT-RUNTIME-TRUTH-AUDIT-2026-09-15

## STAGE.zip note

`PerfectCorp_CameraKit_2.5.0_STAGE.zip` on Desktop is a **staging/prep folder**, not the production SDK source used in `ios/Vendor`.

Vendor SOURCE_MANIFEST:
```
source_zip=PerfectCorp_Mobile_CameraKit_8296658a-d9dd-45ce-ad4d-7cee3d03de45.zip
sha256=18623f4db94f0d792418765efb237d4a2e943266ad2a090f9168397df3b73c44
artifact=PerfectLibCameraKit.xcframework
```

## 1 — Framework

| Check | Result |
|---|---|
| xcframework on disk | FOUND `ios/Vendor/PerfectCameraKit/PerfectLibCameraKit.xcframework` |
| CocoaPods | `PerfectLibCameraKit (2.5.0)` in Podfile.lock |
| Runtime load | YES — `PerfectLibCameraKitVer` returned + quality delegate fired |

## 2 — Initialization (physical log)

```
flutter: Mira PerfectCameraKit init: version=2.5.0.000000 level=moderate yaw=10.0 size=0.6499999761581421
```

| Check | Result |
|---|---|
| `CameraKit.create` called | YES |
| Success | YES |
| Model path | VALID (create succeeded; MODERATE params returned) |

## 3 — Frame pipeline (physical log session 80177)

| Check | Result |
|---|---|
| Preview frames sent | YES |
| Quality callbacks received | YES — **450** Dart lines `Mira PerfectCameraKit quality:` |
| Non-unknown quality | **ZERO** — every callback was `area=unknown pose=unknown light=unknown deg=0.0 ready=false` |
| `ready=true` ever | NO |

Conclusion: `sendCameraBuffer` **is reached** (delegate only fires after buffer processing).  
Buffers are **not analyzable** by CameraKit → no FacePose/FaceArea/Lighting signal.

## 4 — Quality owner (code + runtime)

When `_cameraKitActive == true` (init success):
- Capture gate = `PerfectCameraKitGate.isReady` / `isStableReady` only
- Capture Mirror MediaPipe gate = **disabled** (`_mirrorEnabled => !_cameraKitActive && …`)
- MediaPipe remains overlay-only

**Named owner:** Perfect CameraKit  
**Effective owner:** Perfect CameraKit **stubbed by invalid frame analysis** (always unknown → never READY → never auto-capture).  
This matches physical video: no reject-on-tilt, no Perfect READY, no Perfect auto-capture.

## 5 — Physical pose matrix

Cannot PASS: CameraKit never emits pose=bad / area=too_small / lighting_* — only unknown.

## Verdict

Integration is **partial**:
- Framework linked ✅
- create() ✅
- frames → sendCameraBuffer → callback ✅
- usable quality authority ❌

Next work (separate task): fix NV12/orientation/pixel-format frame binding until callbacks show real `good`/`bad`/`tooSmall` values.
