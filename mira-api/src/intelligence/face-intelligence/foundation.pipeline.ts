/**
 * Phase 4A — Face Foundation pipeline (extracted for clean layering).
 */

import {
  buildSkeletonCanonicalFaceModel,
  CanonicalFaceModel,
  FACE_FOUNDATION_VERSION,
} from './canonical-face.model';
import {
  emptyLandmarkFrame,
  LandmarkFrameSummary,
  summarizeLandmarkInput,
  MeshRegionId,
} from './landmark-frame';
import {
  evaluateMeasurementEligibility,
  MeasurementEligibilityResult,
  PoseSignals,
} from './measurement-eligibility';

export interface FaceFoundationInput {
  analysisId?: string;
  pose: PoseSignals;
  landmarks?: {
    pointCount?: number;
    hasOutline?: boolean;
    regionIdsPresent?: MeshRegionId[];
    trackingQuality?: 'low' | 'medium' | 'high';
    boundingBoxNorm?: LandmarkFrameSummary['boundingBoxNorm'];
    source?: LandmarkFrameSummary['source'];
  };
  provider?: string;
  isMock?: boolean;
}

export interface FaceFoundationResult {
  version: typeof FACE_FOUNDATION_VERSION;
  analysisId: string;
  eligibility: MeasurementEligibilityResult;
  landmarks: LandmarkFrameSummary;
  model: CanonicalFaceModel;
  readyForGeometry: boolean;
  limitations: string[];
  generatedAt: string;
}

export function runFaceFoundationPipeline(
  input: FaceFoundationInput,
): FaceFoundationResult {
  const eligibility = evaluateMeasurementEligibility(input.pose);

  const landmarks = input.landmarks
    ? summarizeLandmarkInput(input.landmarks)
    : emptyLandmarkFrame('Landmark summary not provided.');

  const model = buildSkeletonCanonicalFaceModel({
    measurementEligible: eligibility.eligible,
    eligibilityReasonCodes: eligibility.reasonCodes,
    provider: input.provider,
    isMock: input.isMock,
  });

  const readyForGeometry =
    eligibility.eligible && landmarks.hasOutline && landmarks.pointCount >= 8;

  return {
    version: FACE_FOUNDATION_VERSION,
    analysisId: input.analysisId ?? 'pending',
    eligibility,
    landmarks,
    model,
    readyForGeometry,
    limitations: [
      ...model.limitations,
      ...landmarks.limitations.slice(0, 2),
      eligibility.eligible
        ? 'Eligible for Phase 4B geometry when anchors are supplied.'
        : 'Not eligible — all face metrics unavailable.',
    ],
    generatedAt: new Date().toISOString(),
  };
}
