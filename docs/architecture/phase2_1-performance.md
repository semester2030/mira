# Phase 2.1 Performance Results

Measured on Node v25.1.0 · 8 iterations · warmup excluded.

| Stage | Avg (ms) | P95 (ms) | Max (ms) |
|-------|----------|----------|----------|
| Pixel quality (measurePixelMetrics) | 2.9 | 3.3 | 3.3 |
| Face presence (BlazeFace) | 97.3 | 154.4 | 154.4 |
| Heap used (MB) | 35.1 | 40.8 | 40.8 |

## Notes

- Backend: TensorFlow.js **cpu** (no native tfjs-node in this build).
- Face alignment timing is Flutter-side (`FaceImageProcessor.alignForAnalysis`).
- Memory: process heapUsed samples after each iteration.

## JSON

```json
{
  "version": "phase2.1-perf-v1",
  "iterations": 8,
  "imageBytes": 7014,
  "qualityEvaluationMs": {
    "avg": 2.880073125000081,
    "p95": 3.2558749999998327,
    "max": 3.2558749999998327
  },
  "facePresenceMs": {
    "avg": 97.27008850000004,
    "p95": 154.40708300000006,
    "max": 154.40708300000006
  },
  "heapUsedMb": {
    "avg": 35.10908794403076,
    "p95": 40.81019592285156,
    "max": 40.81019592285156
  },
  "notes": [
    "BlazeFace on tfjs cpu backend (no tfjs-node).",
    "Alignment not timed here (Flutter-only).",
    "Acceptable lab target: face P95 < 5000ms on laptop CPU after warmup."
  ]
}
```
