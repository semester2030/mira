# Official SDK source verification

```
file=PerfectCorp_Mobile_CameraKit_8296658a-d9dd-45ce-ad4d-7cee3d03de45.zip
path=/Users/fayez/Desktop/مراجع تطبيق ميرا /PerfectCorp_Mobile_CameraKit_8296658a-d9dd-45ce-ad4d-7cee3d03de45.zip
sha256_expected=18623f4db94f0d792418765efb237d4a2e943266ad2a090f9168397df3b73c44
sha256_actual=18623f4db94f0d792418765efb237d4a2e943266ad2a090f9168397df3b73c44
match=YES
INSPECT_ZIP_USED_AS_SDK_SOURCE=NO
```

# Integration manifest

| Artifact | Path in repo |
|---|---|
| XCFramework | `ios/Vendor/PerfectCameraKit/PerfectLibCameraKit.xcframework` |
| Models | `ios/Vendor/PerfectCameraKit/model/*` |
| Podspec | `ios/Vendor/PerfectCameraKit/PerfectLibCameraKit.podspec` |
| Podfile | `pod 'PerfectLibCameraKit', :path => 'Vendor/PerfectCameraKit'` |
| Native owner | `ios/Runner/PerfectCameraKitChannel.swift` |
| Dart gate | `lib/features/skin_analysis/presentation/capture/perfect_camera_kit_gate.dart` |
| Capture UI | `lib/features/skin_analysis/presentation/widgets/face_capture_panel.dart` |

# Version

`PerfectLibCameraKitVer` = `2.5.0.000000`

# Quality configuration (official MODERATE — no custom overwrite)

| Parameter | MODERATE preset (SDK docs) |
|---|---|
| faceSizeRatio | 0.65 |
| faceYaw | 10.0 |
| facePitchUpper | 5.0 |
| facePitchLower | -15.0 |
| lightingUpper | 0.85 |
| lightingLower | 0.70 |

CUSTOM OVERRIDES = NONE

# Stable window

Dart: `PerfectCameraKitGate.stableWindow = 800 ms` continuous `ready==true`.
SDK sample has no built-in latch; MIRA implements documented ~800ms stability before auto capture.

# Same-image / no-warp

When `_cameraKitActive`:
- `_validateFile` accepts without MediaPipe final gate
- `_normalizeAcceptedCapture` returns raw file (no `alignForAnalysis` roll/warp)
