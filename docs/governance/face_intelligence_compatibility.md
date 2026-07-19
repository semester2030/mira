# Face Intelligence Compatibility Matrix (v1.0.0)

**Compatibility version:** `face-compat-v1`

## Current stack

| Layer | Compatible with |
|-------|-----------------|
| API Face Intel 1.0.0 | Nest `IntelligenceService` beauty report |
| Flutter upload bridge | Multipart `faceIntel` + runtime |
| Flutter UI | `FaceIntelligenceReport` DTO `face-report-v1` |
| Capture quality | `cq-thresholds-v2.1` |
| Skin sibling | Skin Intelligence / FaceHealthMap (parallel fields) |

## Backward compatibility

| Client age | Server 1.0.0 behavior |
|------------|------------------------|
| No `faceIntel` field | `faceIntelligenceRuntime.status = NOT_REQUESTED`; no invent |
| `faceIntel` without `runtime` | Server derives runtime; pipeline if pose present |
| Stored reports without `faceIntelligence` | Optional field absent; UI hides section |
| Stored reports without `faceIntelligenceRuntime` | Optional; UI may omit notice |

## Future provider compatibility

| Provider | Face Intel impact |
|----------|-------------------|
| MediaPipe (current on-device) | Extractor only; engines unchanged |
| Replacement landmark provider | Must emit `GeometryAnchors` + pose; **no** engine changes if DTO stable |
| Perfect Corp | Skin only — must not feed Face Report schema |
| ML Kit / BlazeFace | Capture / presence only |

## DTO compatibility

- Additive optional fields: forward-compatible (MINOR).  
- Removing/renaming fields: **not** backward-compatible (MAJOR).  
- `unavailable` metrics must keep `normalizedValue` null.

## API compatibility

- Production entry: `POST /ai/skin-analysis` with optional/required operational `faceIntel` JSON.  
- Health: `GET /health` → `intelligence.faceIntelligence.*` versions (no secrets).

## Flutter compatibility

- Production: bridge + mapper + section/notice.  
- Flutter Face*Pipeline mirrors: **not** required for production 1.0.0; gated for tests/offline.

## Incompatibility examples (forbidden without MAJOR)

- Overloading `faceHealthMap` with Face Intel metrics  
- Returning attractiveness / beauty score from Face Intel  
- Silent null `faceIntel` without runtime  
- Second production Face Report builder
