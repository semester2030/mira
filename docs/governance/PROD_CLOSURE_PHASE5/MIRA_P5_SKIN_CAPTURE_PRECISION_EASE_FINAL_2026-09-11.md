# MIRA-P5-SKIN-CAPTURE-PRECISION-EASE-FINAL-2026-09-11

## BEFORE friction ranking (architecture + owner recording)

Owner physical recording: Auto Capture works; too many movements before READY.
No frame-level video telemetry file was available; ranking uses:

1. Gate evaluation order (historical): `face_off_center` checked **before** scale → false “center” hunting while distance wrong.
2. Live center ENTRY was tighter (0.11/0.10) than `FaceCaptureReadinessPolicy.defaults` (0.13/0.11) while `FaceImageProcessor.alignForAnalysis` recenters crops.
3. No live EXIT hysteresis on mesh gate → READY flicker near thresholds.

### Ranked friction (BEFORE)

| Rank | Gate | Est. share of wait | Evidence |
|---|---|---|---|
| #1 | `face_off_center` (esp. centerY) | ~40–55% | first-fail order + tight entry + phone-hold |
| #2 | `face_too_far` / `face_too_close` | ~20–30% | narrow 0.74–1.06, no exit hyst; masked by #1 |
| #3 | pose near-threshold flicker (`mesh_yaw/pitch/roll`) | ~15–25% | hard reset on ±noise without exit band |

## Classification

### ANALYSIS-CRITICAL
one face · landmark quality · required regions (forehead/cheeks/nose/chin) · material blur/quality (post-capture)

### GEOMETRY-CRITICAL
yaw ≤15° · pitch ≤15° · roll ≤12° · scale ENTRY 0.74–1.06 · anatomy visibility

### NORMALIZABLE / GUIDANCE
`face_off_center` within safe envelope (crop via `alignForAnalysis`) · soft EXIT bands for center/scale/pose noise after READY

## Exact changes

| Change | Before | After | Why safe |
|---|---|---|---|
| maxCenterDriftX/Y | 0.11 / 0.10 | **0.13 / 0.11** | Matches FaceCaptureReadinessPolicy.defaults; crop recenters |
| Instruction priority | center before scale | **scale → pose → center** | Same hard limits; correct dominant cue |
| centerY copy | “منتصف الإطار” / head cues | **ارفع/اخفض الهاتف** | Frame position ≠ head pitch |
| Live EXIT hysteresis | hold soft center only | **stabilizer + hold: center +0.02, scale ±0.03, pose +2°** | ENTRY ceilings unchanged |
| Hold window | 480ms | 420ms | Still short stability, not countdown |
| Pose ENTRY | 15/15/12 | **unchanged** | Precision preserved |

## AFTER physical matrix

Owner must complete 10 natural HUD-off attempts. Candidate installed for review.
