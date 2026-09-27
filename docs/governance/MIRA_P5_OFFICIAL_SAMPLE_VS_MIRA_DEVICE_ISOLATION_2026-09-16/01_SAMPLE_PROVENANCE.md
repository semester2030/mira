# 01 — SAMPLE PROVENANCE

| Item | Value |
|---|---|
| Source package | `PerfectCorp_Mobile_CameraKit_2.5.0_INSPECT` (local vendor drop) |
| Path | `…/2.5.0/camerakit-ios/Sample-iOS-CameraKitDemo` |
| Run copy (independent) | `/Users/fayez/Desktop/mira_camerakit_official_sample_run` |
| SDK header | `PerfectLibCameraKitVer = 2.5.0.000000` (sample + Mira identical) |
| Framework binary size | 9 372 856 bytes both |
| Models | `CameraKitDemo/model/*` SHA256 match Mira `ios/Vendor/PerfectCameraKit/model/*` |
| `canCapture` file | `CameraKitDemo/CAMERA_KIT/CameraKitViewController.swift` lines 14–17 |
| `isValid` docs | `PFCameraKitData.h`: “Indicating if the information is valid.” (no further semantics) |
| Frame path | AVCaptureVideoDataOutput `kCVPixelFormatType_420YpCbCr8BiPlanarFullRange` → `sendCameraBuffer` |
| Signing for device | Retargeted to team `A97F7227YM`, bundle `app.mira.camerakit.sample` (Perfect team profiles unavailable). Still the official sample sources + SDK. |

Isolation-only edits (not threshold changes): default Moderate, diagnostic NSLog, auto-open CameraKit screen, AppIcon folder rename for Xcode build.
