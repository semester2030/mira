# MIRA override of camera_avfoundation 0.10.1

Intentional changes vs stock 0.10.1:

1. iOS `yuv420` → `kCVPixelFormatType_420YpCbCr8BiPlanarFullRange`.
2. When Runner exports `MiraCameraKitFeedEmit`, forward the original
   `AVCapture` sample buffer (same session — not a second camera).
3. Front video-data: do not force `isVideoMirrored` (UI flips preview).
4. When CameraKit feed is linked: `alwaysDiscardsLateVideoFrames = false`
   (matches official sample; stock Flutter uses true).

Factor A/B note: a prior experiment feeding a sibling output without
`videoOrientation` was **disproven** for `under_exposed` (see lighting
factor package) and was reverted.

Wired via `pubspec.yaml` dependency_overrides → this path package.
