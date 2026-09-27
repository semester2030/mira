# 03 — FRAME CONTRACT EVIDENCE

| Fact | Class | Source |
|---|---|---|
| Flutter iOS yuv420 = VideoRange biplanar | VERIFIED | camera_avfoundation 0.10.1 |
| CameraKit wants FullRange for AVCapture settings | VERIFIED | PFCameraKit.h + sample videoSettings |
| MIRA expands VideoRange→FullRange | CODE | PerfectCameraKitChannel.makeNv12SampleBuffer |
| Expand cures under_exposed | UNKNOWN | No A/B |
| Stride 768→720 width 720×1280 | DEVICE | FIRST_FRAME_CONFIG / sendCameraBuffer logs |
| Host receive time via CACurrentMediaTime | CODE | labeled receive, not capture PTS |
| Original Flutter capture PTS | UNAVAILABLE | |
| Partial planes dropped | CODE | |
| Native pending depth | DEVICE | pending≈1 (no backlog observed) |
| meanY example | DEVICE | 42.6 → 160.3 within ~1s |

Official sample captures FullRange directly from AVCapture — Mira reconstructs from Flutter planes (different path; contract risk remains for isValid unexplained).
