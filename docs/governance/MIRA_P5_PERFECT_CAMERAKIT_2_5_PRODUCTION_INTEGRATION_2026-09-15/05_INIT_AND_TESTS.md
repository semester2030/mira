# Initialization evidence (physical iPhone debug session)

```
device=fayez's iPhone (arm64 iPhone 14 Plus)
flutter_log=
flutter: Mira PerfectCameraKit init: version=2.5.0.000000 level=moderate yaw=10.0 size=0.6499999761581421
```

Interpretation:
- XCFramework linked and loaded
- Models path resolved (createWithModelPath succeeded)
- Official MODERATE applied (faceYaw=10.0, faceSizeRatio≈0.65)
- CUSTOM OVERRIDES = NONE

# Tests

```
flutter test test/features/skin_analysis/perfect_camera_kit_gate_test.dart
→ All tests passed! (guidance AR + 800ms stable window)
```

# Callback / auto-capture / auto-analysis

Code evidence:
- EventChannel emits on `CameraKitDelegate.checkedResult`
- Dart listener `_onCameraKitQuality` → stable 800ms → `_capture(fromAuto: true)`
- `NewAnalysisScreen.onImageChanged` auto-calls `onAnalyze` (no «بدء التحليل» CTA on happy path)

Live pose reject matrix + continuous video: see `04_PHYSICAL_IPHONE.md` (BLOCKED pending owner recording).
