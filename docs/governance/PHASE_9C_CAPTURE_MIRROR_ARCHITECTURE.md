# Capture Mirror Architecture

```
CameraImage → LiveFaceOverlayController (existing)
→ FaceMeshFrame
→ CaptureMirrorCoordinator.inputFromMesh + tick
→ FaceCaptureReadinessEvaluator (9B)
→ FaceCaptureGuidanceVm
→ InteractiveCaptureMirrorOverlay + shutter/latch
```

9C owns presentation + camera orchestration.
9B owns readiness truth.
