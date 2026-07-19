/**
 * Phase 4.5 / Operational Hardening — Parse on-device faceIntel multipart field.
 *
 * Always returns explicit runtime state (never silent omission).
 */

import {
  anchorsAreValid,
  GeometryAnchors,
  GEOMETRY_ANCHORS_VERSION,
  NormPoint,
} from './geometry/geometry-anchors';
import { PoseSignals } from './measurement-eligibility';
import { FaceReportPipelineInput } from './report.pipeline';
import { MeshRegionId } from './landmark-frame';
import {
  FACE_INTEL_RUNTIME_NOT_REQUESTED,
  FaceIntelRuntimeStateDto,
  faceIntelRuntimeFailed,
  faceIntelRuntimeUnavailable,
  parseFaceIntelRuntime,
} from './face-intel-runtime-state';

export interface ParsedFaceIntelPackage {
  runtime: FaceIntelRuntimeStateDto;
  /** Present when Face Report pipeline should execute (pose available). */
  input?: FaceReportPipelineInput;
}

function isNormPoint(v: unknown): v is NormPoint {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.x === 'number' && typeof p.y === 'number';
}

function parseAnchors(raw: unknown): GeometryAnchors | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const a = raw as Record<string, unknown>;
  const keys = [
    'foreheadTop',
    'browMid',
    'noseTip',
    'noseBase',
    'chin',
    'leftEyeOuter',
    'leftEyeInner',
    'rightEyeInner',
    'rightEyeOuter',
    'leftMouth',
    'rightMouth',
    'leftFace',
    'rightFace',
    'leftAla',
    'rightAla',
    'leftJaw',
    'rightJaw',
  ] as const;

  for (const k of keys) {
    if (!isNormPoint(a[k])) return undefined;
  }

  const source = a.source;
  if (
    source !== 'mediapipe_mesh' &&
    source !== 'synthetic_test' &&
    source !== 'mock'
  ) {
    return undefined;
  }

  const anchors: GeometryAnchors = {
    version: GEOMETRY_ANCHORS_VERSION,
    foreheadTop: a.foreheadTop as NormPoint,
    browMid: a.browMid as NormPoint,
    noseTip: a.noseTip as NormPoint,
    noseBase: a.noseBase as NormPoint,
    chin: a.chin as NormPoint,
    leftEyeOuter: a.leftEyeOuter as NormPoint,
    leftEyeInner: a.leftEyeInner as NormPoint,
    rightEyeInner: a.rightEyeInner as NormPoint,
    rightEyeOuter: a.rightEyeOuter as NormPoint,
    leftMouth: a.leftMouth as NormPoint,
    rightMouth: a.rightMouth as NormPoint,
    leftFace: a.leftFace as NormPoint,
    rightFace: a.rightFace as NormPoint,
    leftAla: a.leftAla as NormPoint,
    rightAla: a.rightAla as NormPoint,
    leftJaw: a.leftJaw as NormPoint,
    rightJaw: a.rightJaw as NormPoint,
    source,
  };

  if (!anchorsAreValid(anchors)) return undefined;
  return anchors;
}

function parsePose(raw: unknown): PoseSignals | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const p = raw as Record<string, unknown>;
  const out: PoseSignals = {};

  const copyNum = (key: keyof PoseSignals) => {
    const v = p[key as string];
    if (typeof v === 'number' && Number.isFinite(v)) {
      (out as Record<string, number>)[key as string] = v;
    }
  };
  const copyBool = (key: keyof PoseSignals) => {
    const v = p[key as string];
    if (typeof v === 'boolean') {
      (out as Record<string, boolean>)[key as string] = v;
    }
  };

  copyNum('faceCount');
  copyNum('faceAreaRatio');
  copyNum('headYawDegrees');
  copyNum('headPitchDegrees');
  copyNum('headRollDegrees');
  copyNum('centerOffsetXRatio');
  copyNum('centerOffsetYRatio');
  copyBool('facePresent');
  copyBool('captureQualityAcceptable');

  if (Object.keys(out).length === 0) return undefined;
  return out;
}

function parseLandmarks(
  raw: unknown,
): FaceReportPipelineInput['landmarks'] | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const lm = raw as Record<string, unknown>;
  return {
    pointCount: typeof lm.pointCount === 'number' ? lm.pointCount : undefined,
    hasOutline: typeof lm.hasOutline === 'boolean' ? lm.hasOutline : undefined,
    trackingQuality:
      lm.trackingQuality === 'low' ||
      lm.trackingQuality === 'medium' ||
      lm.trackingQuality === 'high'
        ? lm.trackingQuality
        : undefined,
    source:
      lm.source === 'mediapipe_mesh' ||
      lm.source === 'unavailable' ||
      lm.source === 'mock'
        ? lm.source
        : undefined,
    regionIdsPresent: Array.isArray(lm.regionIdsPresent)
      ? (lm.regionIdsPresent.filter((x) => typeof x === 'string') as MeshRegionId[])
      : undefined,
  };
}

/**
 * Operational Hardening entry — always returns explicit runtime.
 */
export function parseFaceIntelPackage(raw: unknown): ParsedFaceIntelPackage {
  if (raw == null || raw === '') {
    return { runtime: FACE_INTEL_RUNTIME_NOT_REQUESTED };
  }

  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { runtime: FACE_INTEL_RUNTIME_NOT_REQUESTED };
    }
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return {
        runtime: faceIntelRuntimeFailed('face_intel_json_parse_error', 'parse'),
      };
    }
  }

  if (typeof value !== 'object' || value === null) {
    return {
      runtime: faceIntelRuntimeFailed('face_intel_invalid_shape', 'parse'),
    };
  }

  const o = value as Record<string, unknown>;
  const clientRuntime = parseFaceIntelRuntime(o.runtime);
  const pose = parsePose(o.pose);
  const anchors = parseAnchors(o.anchors);
  const landmarks = parseLandmarks(o.landmarks);

  if (!pose) {
    return {
      runtime:
        clientRuntime?.status === 'FAILED'
          ? clientRuntime
          : faceIntelRuntimeFailed('pose_missing', 'parse'),
    };
  }

  const input: FaceReportPipelineInput = {
    pose,
    anchors: anchors ?? null,
    landmarks,
    analysisId: typeof o.analysisId === 'string' ? o.analysisId : undefined,
    captureVersion:
      typeof o.captureVersion === 'string' ? o.captureVersion : undefined,
    provider: typeof o.provider === 'string' ? o.provider : undefined,
    isMock: o.isMock === true,
    language:
      o.language === 'ar' || o.language === 'en' || o.language === 'ar+en'
        ? o.language
        : undefined,
  };

  let runtime: FaceIntelRuntimeStateDto =
    clientRuntime ??
    (anchors
      ? {
          status: 'AVAILABLE',
          reason: 'face_intel_inputs_ready',
          stage: 'parse',
          confidence: 85,
          userVisibleAr: 'تم تجهيز قراءة الملامح.',
          userVisibleEn: 'Face feature reading is ready.',
        }
      : faceIntelRuntimeUnavailable('anchors_missing', 'parse', 35));

  // FAILED with pose still runs pipeline so metrics stay unavailable (never invent).
  if (runtime.status === 'FAILED' && !anchors) {
    return { runtime, input };
  }

  if (runtime.status === 'SKIPPED') {
    return { runtime };
  }

  if (runtime.status === 'NOT_REQUESTED') {
    return { runtime: FACE_INTEL_RUNTIME_NOT_REQUESTED };
  }

  return { runtime, input };
}

/**
 * @deprecated Prefer parseFaceIntelPackage — kept for unit tests expecting input-only.
 */
export function parseFaceIntelInput(
  raw: unknown,
): FaceReportPipelineInput | undefined {
  return parseFaceIntelPackage(raw).input;
}
