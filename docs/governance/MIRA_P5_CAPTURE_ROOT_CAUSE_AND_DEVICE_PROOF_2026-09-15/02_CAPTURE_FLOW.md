# 02 — CAPTURE FLOW (actual owners)

```
NewAnalysisScreen._buildAnalysisBody
  → FaceCapturePanel
      → PerfectCameraKitGate.initialize(level: moderate)   // PerfectCameraKitGate.initialize
      → CameraController.initialize + setExposureMode(auto) + setFocusMode(auto)
      → PerfectCameraKitGate.onCameraOpen
      → startImageStream → _onCameraImage
          → PerfectCameraKitGate.sendCameraImage            // NV12 planes
          → MethodChannel sendFrameYv12
              → PerfectCameraKitOwner.sendFrame             // PerfectCameraKitChannel.swift
              → makeNv12SampleBuffer (VideoRange→FullRange expand)
              → CameraKit.sendCameraBuffer
          → CameraKitDelegate.checkedResult
              → EventChannel → PerfectCameraKitGate._onEvent
      → _onCameraKitQuality
          → if isStableReady (800ms) → _capture(fromAuto: true)
      → _CaptureControls shutter
          → enabled iff PerfectCameraKitGate.isReady (when _cameraKitActive)
          → onCapture → _capture(fromAuto: false)
      → _capture
          → CameraController.takePicture
          → _validateFile (CameraKit path: accept without MediaPipe final gate)
          → onImageChanged(file)
  → NewAnalysisScreen.onImageChanged
      → if becameCaptured → onAnalyze()   // AUTO ANALYSIS — no «بدء التحليل» CTA
```

## Shutter button

| Question | Answer |
|---|---|
| Visible? | YES (`_CaptureControls`) |
| Enabled when? | `shutterEnabled` requires `_canTakePhoto` → `PerfectCameraKitGate.isReady` |
| Handler | `_capture(fromAuto: false)` |
| Same path as auto? | YES — same `_capture`; auto requires `isStableReady` |

## READY definition (native)

```
lightingOk = (light == good || light == normal)
ready = areaOk && poseOk && lightingOk && isValid
```

`under_exposed` ⇒ `lightingOk=false` ⇒ `ready=false`.
