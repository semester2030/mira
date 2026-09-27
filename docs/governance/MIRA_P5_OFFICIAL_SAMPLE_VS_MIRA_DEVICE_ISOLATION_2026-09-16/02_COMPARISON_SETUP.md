# 02 — COMPARISON SETUP

| Setting | Sample | Mira |
|---|---|---|
| Device | same iPhone USB | same |
| SDK / models | 2.5.0.000000 / matched hashes | same |
| Camera | front | front |
| Level after init | Moderate (read from `currentParameter`) | moderate |
| lightingLower/Upper | 0.70 / 0.85 | 0.70 / 0.85 |
| Experimental override | none | none (`experimental=0`) |
| Orientation | portrait | portrait |
| Frame supply | Native AVCapture FullRange | Flutter yuv420 VideoRange → native expand FullRange |
| Analysis stream size | FullRange buffers from session (preview/photo path) | 720×1280, yStride=768 |
| Capture photo | AVCapturePhotoOutput | Flutter `takePicture` after READY stable |

## Documented non-identical factors

- Pixel pipeline (native FullRange vs Flutter rebuild) — **cannot unify without Mira code change**.
- Preview geometry / face-to-frame ratio may differ (sample uses its own oval/layout; Mira uses capture guide).
- Sequential runs (~2 min apart); lighting environment assumed similar but not instrumented with a lux meter.

Final config was read **after** `setCameraKitLevel` via `currentParameter` logs on both sides.
