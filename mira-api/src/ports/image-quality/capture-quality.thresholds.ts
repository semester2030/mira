/**
 * Canonical capture-quality thresholds (Phase 2.1).
 * Single source for Nest pixel gate + face presence.
 * Flutter mirror: lib/features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart
 *
 * Rationale (documented, not Remote Config — change requires version bump):
 * - Blur 28/55: Laplacian variance; flat gray <28; usable selfies typically 40–400+.
 * - Brightness 0.18–0.92: reject crushed blacks / washed whites; soft ideal 0.32–0.78.
 * - Pose: frontal selfie band aligned with ML Kit client gate (yaw 35°, pitch 30°, roll 28°).
 * - Face area 5%–92%: too far / too close for skin analysis.
 * - BlazeFace minScore 0.75: high precision; synthetic photo-like faces ~0.99 in lab.
 */
export const CAPTURE_QUALITY_THRESHOLDS = {
  version: 'cq-thresholds-v2.1',

  minBlurVariance: 28,
  warnBlurVariance: 55,

  minBrightness: 0.18,
  maxBrightness: 0.92,
  idealBrightnessLow: 0.32,
  idealBrightnessHigh: 0.78,

  maxOverExposureRatio: 0.18,
  maxUnderExposureRatio: 0.22,
  maxShadowImbalance: 0.35,
  /** Soft penalty only — not a hard block. */
  warnShadowImbalance: 0.22,

  minShortEdgePx: 480,

  minFaceAreaRatio: 0.05,
  maxFaceAreaRatio: 0.92,

  maxYawDegrees: 35,
  maxPitchDegrees: 30,
  maxRollDegrees: 28,
  /** Soft angle penalty above this (degrees). */
  warnCombinedAngleDegrees: 15,

  /** BlazeFace probability floor for accepting a detection. */
  blazefaceMinScore: 0.75,
  /** Exactly one face required for skin. */
  requiredFaceCount: 1,

  /**
   * Contrast & dynamicRange are INFORMATIONAL ONLY (Phase 2.1 Option A).
   * They are measured and reported but do not affect proceed/block scoring.
   */
  contrastDynamicRangeRole: 'informational' as const,
} as const;

export type CaptureQualityThresholds = typeof CAPTURE_QUALITY_THRESHOLDS;
