# Changed files

```
ios/Vendor/PerfectCameraKit/**                     (xcframework + models + podspec)
ios/Podfile                                        (+ PerfectLibCameraKit path pod)
ios/Runner/PerfectCameraKitChannel.swift           (NEW — native owner)
ios/Runner/AppDelegate.swift                       (register channel)
ios/Runner.xcodeproj/project.pbxproj               (Swift file in Sources)
lib/.../capture/perfect_camera_kit_gate.dart       (NEW — Dart façade)
lib/.../widgets/face_capture_panel.dart            (CameraKit gate + guidance + auto)
docs/governance/MIRA_P5_PERFECT_CAMERAKIT_2_5_PRODUCTION_INTEGRATION_2026-09-15/**
```

NOT modified (task boundary):
- Perfect Skin Analysis API / backend
- ephemeralMasks / PerfectMaskSession
- Face Explorer / Apple Matte / skin map / metric carousel
- mask decode / presentation / scores / result UI
