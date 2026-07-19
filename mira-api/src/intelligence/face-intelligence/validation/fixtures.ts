/**
 * Phase 4F — Face Intelligence validation fixtures.
 */
import { GeometryAnchors } from '../geometry/geometry-anchors';
import {
  FaceReportPipelineInput,
  runFaceReportPipeline,
} from '../report.pipeline';
import { FaceIntelligenceReportDto } from '../report/face-report.engine';

export interface FaceAnalysisFixture {
  id: string;
  description: string;
  input: FaceReportPipelineInput;
}

function baseAnchors(overrides?: Partial<GeometryAnchors>): GeometryAnchors {
  return {
    version: 'geometry-anchors-v1',
    foreheadTop: { x: 0.5, y: 0.22 },
    browMid: { x: 0.5, y: 0.34 },
    noseTip: { x: 0.5, y: 0.52 },
    noseBase: { x: 0.5, y: 0.58 },
    chin: { x: 0.5, y: 0.78 },
    leftEyeOuter: { x: 0.31, y: 0.36 },
    leftEyeInner: { x: 0.42, y: 0.36 },
    rightEyeInner: { x: 0.58, y: 0.36 },
    rightEyeOuter: { x: 0.69, y: 0.36 },
    leftMouth: { x: 0.4, y: 0.68 },
    rightMouth: { x: 0.6, y: 0.68 },
    leftFace: { x: 0.29, y: 0.5 },
    rightFace: { x: 0.71, y: 0.5 },
    leftAla: { x: 0.44, y: 0.55 },
    rightAla: { x: 0.56, y: 0.55 },
    leftJaw: { x: 0.325, y: 0.72 },
    rightJaw: { x: 0.675, y: 0.72 },
    source: 'synthetic_test',
    ...overrides,
  };
}

const eligiblePose = {
  faceCount: 1,
  faceAreaRatio: 0.3,
  headYawDegrees: 0,
  headPitchDegrees: 0,
  headRollDegrees: 0,
  facePresent: true,
  captureQualityAcceptable: true,
};

export const FACE_ANALYSIS_FIXTURES: FaceAnalysisFixture[] = [
  {
    id: 'oval',
    description: 'Frontal oval-dominant hybrid shape',
    input: {
      analysisId: 'fix-oval',
      pose: eligiblePose,
      landmarks: {
        pointCount: 468,
        hasOutline: true,
        trackingQuality: 'high',
      },
      anchors: baseAnchors(),
    },
  },
  {
    id: 'heart',
    description: 'Wide forehead / narrow jaw',
    input: {
      analysisId: 'fix-heart',
      pose: eligiblePose,
      landmarks: {
        pointCount: 468,
        hasOutline: true,
        trackingQuality: 'high',
      },
      anchors: baseAnchors({
        leftEyeOuter: { x: 0.27, y: 0.36 },
        rightEyeOuter: { x: 0.73, y: 0.36 },
        leftJaw: { x: 0.39, y: 0.72 },
        rightJaw: { x: 0.61, y: 0.72 },
        leftFace: { x: 0.3, y: 0.5 },
        rightFace: { x: 0.7, y: 0.5 },
      }),
    },
  },
  {
    id: 'oblong',
    description: 'Elongated vertical proportions',
    input: {
      analysisId: 'fix-oblong',
      pose: eligiblePose,
      landmarks: {
        pointCount: 468,
        hasOutline: true,
        trackingQuality: 'high',
      },
      anchors: baseAnchors({
        foreheadTop: { x: 0.5, y: 0.1 },
        chin: { x: 0.5, y: 0.94 },
        leftFace: { x: 0.34, y: 0.5 },
        rightFace: { x: 0.66, y: 0.5 },
        leftJaw: { x: 0.36, y: 0.76 },
        rightJaw: { x: 0.64, y: 0.76 },
        leftEyeOuter: { x: 0.35, y: 0.34 },
        rightEyeOuter: { x: 0.65, y: 0.34 },
      }),
    },
  },
  {
    id: 'ineligible_yaw',
    description: 'Pose ineligible — all invent-forbidden',
    input: {
      analysisId: 'fix-yaw',
      pose: {
        faceCount: 1,
        faceAreaRatio: 0.3,
        headYawDegrees: 50,
        facePresent: true,
        captureQualityAcceptable: true,
      },
      landmarks: { pointCount: 468, hasOutline: true },
      anchors: baseAnchors(),
    },
  },
];

export function runFaceFixturePipeline(fixture: FaceAnalysisFixture) {
  return runFaceReportPipeline(fixture.input);
}

/** Strip non-deterministic generatedAt for golden comparison. */
export function normalizeFaceReportForSnapshot(
  report: FaceIntelligenceReportDto,
): Record<string, unknown> {
  const { generatedAt: _generatedAt, ...rest } = report;
  return JSON.parse(JSON.stringify(rest)) as Record<string, unknown>;
}
