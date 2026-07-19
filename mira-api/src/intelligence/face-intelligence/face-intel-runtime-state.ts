/**
 * Operational Hardening — Face Intelligence runtime states.
 * Shared wire contract with Flutter FaceIntelRuntimeState.
 */

export type FaceIntelRuntimeStatusWire =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'SKIPPED'
  | 'NOT_REQUESTED';

export interface FaceIntelRuntimeStateDto {
  status: FaceIntelRuntimeStatusWire;
  reason: string;
  stage: string;
  /** 0–100 operational confidence (not attractiveness). */
  confidence: number;
  userVisibleAr: string;
  userVisibleEn: string;
}

export function faceIntelRuntimeAvailable(stage: string, confidence = 90): FaceIntelRuntimeStateDto {
  return {
    status: 'AVAILABLE',
    reason: 'face_intel_inputs_ready',
    stage,
    confidence,
    userVisibleAr: 'تم تجهيز قراءة الملامح.',
    userVisibleEn: 'Face feature reading is ready.',
  };
}

export function faceIntelRuntimeUnavailable(
  reason: string,
  stage: string,
  confidence = 40,
): FaceIntelRuntimeStateDto {
  return {
    status: 'UNAVAILABLE',
    reason,
    stage,
    confidence,
    userVisibleAr:
      'قراءة الملامح غير متاحة لهذه اللقطة — أعيدي الالتقاط بوجه أمامي ثابت.',
    userVisibleEn:
      'Face feature reading is unavailable for this capture — retake with a steady frontal face.',
  };
}

export function faceIntelRuntimeFailed(
  reason: string,
  stage: string,
  confidence = 10,
): FaceIntelRuntimeStateDto {
  return {
    status: 'FAILED',
    reason,
    stage,
    confidence,
    userVisibleAr:
      'تعذر إكمال قراءة الملامح — التحليل الجلدي اكتمل دون قسم الملامح.',
    userVisibleEn:
      'Face feature reading failed — skin analysis completed without the face section.',
  };
}

export function faceIntelRuntimeSkipped(
  reason: string,
  stage: string,
): FaceIntelRuntimeStateDto {
  return {
    status: 'SKIPPED',
    reason,
    stage,
    confidence: 0,
    userVisibleAr: 'تم تخطي قراءة الملامح لهذه الجلسة.',
    userVisibleEn: 'Face feature reading was skipped for this session.',
  };
}

export const FACE_INTEL_RUNTIME_NOT_REQUESTED: FaceIntelRuntimeStateDto = {
  status: 'NOT_REQUESTED',
  reason: 'face_intel_not_requested',
  stage: 'client',
  confidence: 0,
  userVisibleAr: 'لم تُطلب قراءة الملامح.',
  userVisibleEn: 'Face feature reading was not requested.',
};

export function parseFaceIntelRuntime(
  raw: unknown,
): FaceIntelRuntimeStateDto | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (
    status !== 'AVAILABLE' &&
    status !== 'UNAVAILABLE' &&
    status !== 'FAILED' &&
    status !== 'SKIPPED' &&
    status !== 'NOT_REQUESTED'
  ) {
    return undefined;
  }
  return {
    status,
    reason: typeof o.reason === 'string' ? o.reason : 'unknown',
    stage: typeof o.stage === 'string' ? o.stage : 'unknown',
    confidence:
      typeof o.confidence === 'number' && Number.isFinite(o.confidence)
        ? Math.max(0, Math.min(100, Math.round(o.confidence)))
        : 0,
    userVisibleAr:
      typeof o.userVisibleAr === 'string' ? o.userVisibleAr : '',
    userVisibleEn:
      typeof o.userVisibleEn === 'string' ? o.userVisibleEn : '',
  };
}
