/**
 * Phase 4A — Measurement eligibility.
 *
 * JUSTIFICATION (new file): Architecture Lock requires Face Intel measurement gate.
 * REUSES CaptureQualityThresholds (cq-thresholds-v2.1) — does not duplicate threshold values.
 * Does NOT replace Flutter FaceGateRules or BlazeFace presence — composes their outcomes.
 */

import { CAPTURE_QUALITY_THRESHOLDS } from '../../ports/image-quality/capture-quality.thresholds';

export const MEASUREMENT_ELIGIBILITY_VERSION = 'face-eligibility-v1';

export interface PoseSignals {
  faceCount?: number;
  faceAreaRatio?: number;
  headYawDegrees?: number;
  headPitchDegrees?: number;
  headRollDegrees?: number;
  centerOffsetXRatio?: number;
  centerOffsetYRatio?: number;
  /** Server BlazeFace / client presence */
  facePresent?: boolean;
  /** Capture quality overallAcceptable when known */
  captureQualityAcceptable?: boolean;
}

export interface MeasurementEligibilityResult {
  version: typeof MEASUREMENT_ELIGIBILITY_VERSION;
  thresholdVersion: string;
  eligible: boolean;
  reasonCodes: string[];
  messageAr: string;
  messageEn: string;
  /** Pose values echoed for provenance (not invented). */
  pose: PoseSignals;
}

/**
 * Pure eligibility for Face Intelligence measurements.
 * Uses the same numeric limits as capture quality / face gate.
 */
export function evaluateMeasurementEligibility(
  pose: PoseSignals,
): MeasurementEligibilityResult {
  const t = CAPTURE_QUALITY_THRESHOLDS;
  const reasonCodes: string[] = [];

  if (pose.captureQualityAcceptable === false) {
    reasonCodes.push('capture_quality_blocked');
  }

  if (pose.facePresent === false) {
    reasonCodes.push('no_face');
  }

  const faceCount = pose.faceCount;
  if (faceCount != null) {
    if (faceCount === 0) reasonCodes.push('no_face');
    if (faceCount > 1) reasonCodes.push('multiple_faces');
  }

  if (
    pose.faceAreaRatio != null &&
    pose.faceAreaRatio < t.minFaceAreaRatio
  ) {
    reasonCodes.push('face_too_small');
  }
  if (
    pose.faceAreaRatio != null &&
    pose.faceAreaRatio > t.maxFaceAreaRatio
  ) {
    reasonCodes.push('face_too_large');
  }

  if (
    pose.headYawDegrees != null &&
    Math.abs(pose.headYawDegrees) > t.maxYawDegrees
  ) {
    reasonCodes.push('head_turned');
  }
  if (
    pose.headPitchDegrees != null &&
    Math.abs(pose.headPitchDegrees) > t.maxPitchDegrees
  ) {
    reasonCodes.push('head_pitch');
  }
  if (
    pose.headRollDegrees != null &&
    Math.abs(pose.headRollDegrees) > t.maxRollDegrees
  ) {
    reasonCodes.push('head_tilted');
  }

  // Center offsets aligned with FaceGateRules constants (single documented values).
  const maxCenterX = 0.13;
  const maxCenterY = 0.11;
  if (
    pose.centerOffsetXRatio != null &&
    Math.abs(pose.centerOffsetXRatio) > maxCenterX
  ) {
    reasonCodes.push('face_off_center');
  }
  if (
    pose.centerOffsetYRatio != null &&
    Math.abs(pose.centerOffsetYRatio) > maxCenterY
  ) {
    reasonCodes.push('face_off_center');
  }

  const unique = [...new Set(reasonCodes)];
  const eligible = unique.length === 0;

  return {
    version: MEASUREMENT_ELIGIBILITY_VERSION,
    thresholdVersion: t.version,
    eligible,
    reasonCodes: unique,
    messageAr: eligible
      ? 'القياس مؤهل — يمكن متابعة هندسة الوجه عندما تتوفر (مرحلة 4B).'
      : 'القياس غير مؤهل — حسّني وضع الوجه/الجودة. المقاييس تبقى غير متاحة.',
    messageEn: eligible
      ? 'Measurement eligible — geometry may proceed when available (Phase 4B).'
      : 'Measurement not eligible — improve pose/quality. Metrics stay unavailable.',
    pose: { ...pose },
  };
}
