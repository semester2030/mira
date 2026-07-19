# Capture Quality Thresholds (Phase 2.1)

## Single source

| Platform | Path |
|----------|------|
| Nest | `mira-api/src/ports/image-quality/capture-quality.thresholds.ts` |
| Flutter | `lib/features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart` |

**Version:** `cq-thresholds-v2.1`

You must keep numeric values identical across both files. Bump version when changing.

## Head pose (unified)

| Axis | Limit | Consumers |
|------|------:|-----------|
| Yaw | 35° | `FaceGateRules`, `QualityConfidenceMapper` |
| Pitch | 30° | `FaceGateRules`, `QualityConfidenceMapper` |
| Roll | 28° | `FaceGateRules`, `QualityConfidenceMapper`, `FaceAlignmentLimits` |

## Contrast / dynamic range (Option A)

**Informational only.** Measured and reported with limitations; **not** used in proceed/block scoring.

Rationale: Laplacian blur + exposure already gate soft focus / washout; contrast std-dev alone caused ambiguous false failures on even makeup lighting. Keep metrics for telemetry / future calibration.

## Configurability

Compile-time constants only (no env). Change requires code review + version bump + dual-file sync.
