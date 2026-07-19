# Image Quality (Phase 2)

## Purpose

Never allow face or skin analysis to run on an unreliable image. Quality is **measured** or explicitly **unavailable** — never invented.

## Pipeline

```
Capture
  → ImageQuality evaluation (pixels + ML Kit face gate)
  → Fail? STOP (no upload, no Perfect credits, no persistence)
  → Face alignment (roll-limited crop)
  → Normalization / prepareForAnalysis
  → Upload
  → Server ImageQualityPort re-check
  → Fail? STOP before orchestrator/provider
  → Analysis
```

## Calculation versions

| Version | Role |
|---------|------|
| `iq-v2.0` / `iq-v2.1` | Flutter `ImageQualityEvaluator` metric suite |
| `qc-v1.1` | Deterministic quality → confidence (no fabricated measured signals) |
| `iq-v2.1+qc-v1.1` | Server adapter + BlazeFace presence |
| `cq-thresholds-v2.1` | Unified thresholds (Flutter + Nest) |

## Phase 2.1 notes

- Server face: BlazeFace — see `server-face-presence.md`
- Contrast / dynamicRange: **informational only** (not scored)
- Thresholds: `capture-quality-thresholds.md`

## Measured metrics (Phase 2)

| Metric | Method | Unit |
|--------|--------|------|
| blur | Laplacian variance on subsampled luma | variance |
| brightness | Mean luma / 255 | 0–1 |
| contrast | Luma std-dev / 255 | 0–1 |
| dynamicRange | Contrast proxy × 2 (capped) | 0–1 |
| overexposure | Fraction luma > 245 | ratio |
| underexposure | Fraction luma < 18 | ratio |
| shadowImbalance | \|mean(left) − mean(right)\| / 255 | 0–1 |
| resolution / shortEdge | Image dimensions | px |
| compressionQuality | File bytes / pixel area | bpp |
| faceCount / coverage / centering / yaw / pitch / roll | ML Kit (client) | various |
| eyeVisibility / mouthVisibility | Landmark presence (client) | 0/1 |

## Unavailable (honest — no fake neutrals)

- occlusion
- hairObstruction
- glassesReflection
- captureDistance
- cameraConfidence
- Server-side yaw/pitch/roll/faceCoverage (structural gate only)

## Thresholds (`ImageQualityThresholds` / `SERVER_IMAGE_QUALITY_THRESHOLDS`)

| Threshold | Value | Rationale |
|-----------|-------|-----------|
| minBlurVariance | 28 | Below → unusable soft focus (block) |
| warnBlurVariance | 55 | Soft band → confidence penalty |
| min/max brightness | 0.18 / 0.92 | Extreme underexposure / washout |
| ideal brightness | 0.32–0.78 | Soft penalty outside band |
| max over/under exposure ratio | 0.18 / 0.22 | Clipped histogram mass |
| max shadow imbalance | 0.35 | Strong side lighting |
| min short edge | 480 px | Provider / face detail floor |
| face area | 0.05–0.92 | Too far / too close |
| max yaw / roll / pitch | 35° / 28° / 30° | Frontal selfie requirement |

## Verdict → confidence (qc-v1)

| Verdict | Meaning | Provider |
|---------|---------|----------|
| excellent | confidence ≥ 85 | Allowed |
| acceptable | 70–84 | Allowed |
| poor | &lt; 70 | **Blocked** (treated as critical) |
| blocked | Hard rule fail | **Blocked** |

`CaptureQualitySignals` used after a successful gate always set `fromMeasuredQuality: true`. Legacy `CaptureQualitySignals.neutral()` must not be used on skin upload paths.

## Live guidance

MediaPipe (`FaceMeshQualityGate`) is **guidance only** — AR + EN short messages. It never claims skin analysis results.

## Provider protection

- Flutter: `SkinCaptureQualityGate` / `SkinAnalysisApiDataSource` before multipart upload
- Nest: `SkinAnalysisService.analyze` evaluates `IMAGE_QUALITY_PORT` before `SkinAnalysisOrchestrator`

## Future extensions

- Occlusion / hair / glasses classifiers
- True JPEG Q-table inspection
- Device AF confidence / depth for captureDistance
- Server ML Kit / face mesh parity with client pose
