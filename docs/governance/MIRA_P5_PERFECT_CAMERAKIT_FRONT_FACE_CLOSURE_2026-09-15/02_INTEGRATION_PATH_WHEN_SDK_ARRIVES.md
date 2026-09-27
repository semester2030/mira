# Integration path (authoritative when SDK is dropped in)

Source: Perfect Corp Mobile CameraKit docs v2.5.0
https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/mobile-camera-kit

## iOS (Flutter Runner — extend existing Skin capture; no second screen)

1. Add `ios/Vendor/PerfectLibCameraKit.framework` (Do Not Embed / static) + `-ObjC -lc++ -framework CoreMotion`
2. Copy Perfect `model/` into Runner bundle
3. One native owner class e.g. `PerfectCameraKitBridge` (singleton):
   - `CameraKit.create(withModelPath:)`
   - `setCameraKitLevel(.moderate)`  ← production baseline
   - `delegate` → FaceArea / FacePose / Lighting `isOk`
   - `onCameraOpen(true)` front only for Skin
   - `sendCameraBuffer(sampleBuffer)` from AVCaptureVideoDataOutput OR
     Flutter→native frame bridge if remaining on `camera` plugin (prefer native AVFoundation
     sample buffers per Perfect lifecycle docs)
   - `onDestroyed()` on dispose
4. Flutter MethodChannel `mira/perfect_camerakit` emits one quality event:
   `{faceAreaOk, facePoseOk, lightingOk, guidanceCode, ready}`
5. `FaceCapturePanel` Skin path:
   - FINAL capture decision = CameraKit ready only
   - MediaPipe may keep decorative mesh overlay only; **must not override** capture
   - Stable window: Perfect `countingDuration` default **800 ms** (or native equivalent)
   - AUTO CAPTURE when stable ready
   - Existing auto-analysis after capture remains (no «بدء التحليل»)

## MODERATE documented defaults (do not invent)

| Signal | MODERATE |
|--------|----------|
| face_ratio_lower | 0.65 |
| yaw | ±10° |
| pitch | -15° … +5° |
| roll | ±10° |
| lighting | 0.70 … 0.85 |
| countingDuration | ~800 ms |

Custom overrides: **NONE** until physical evidence forces a documented `setCameraKitOverwrite`.

## Forbidden

- Post-capture rotate/warp/straighten
- JS Camera Kit / WebView
- Second camera screen if existing Skin capture can be extended
- Multiple CameraKit instances / per-frame init
