/**
 * Phase 4C — Face Features pipeline (shape + findings).
 *
 * JUSTIFICATION: Extends geometry; sole owner of face-shape classification
 * and face feature findings. No recommendations (4D) / report UI (4E).
 */

import { CanonicalFaceModel } from './canonical-face.model';
import {
  FaceGeometryPipelineInput,
  FaceGeometryPipelineResult,
  runFaceGeometryPipeline,
} from './geometry.pipeline';
import { buildFaceFindings, FaceFinding } from './features/face-finding.engine';
import {
  applyFaceShapeToCanonicalModel,
  classifyFaceShape,
  FACE_SHAPE_FORMULA_ID,
  FACE_SHAPE_VERSION,
  FaceShapeClassification,
} from './features/face-shape.classifier';

export interface FaceFeaturesPipelineInput extends FaceGeometryPipelineInput {}

export interface FaceFeaturesPipelineResult extends FaceGeometryPipelineResult {
  shapeVersion: typeof FACE_SHAPE_VERSION;
  shapeFormulaId: typeof FACE_SHAPE_FORMULA_ID;
  shape: FaceShapeClassification;
  findings: FaceFinding[];
  model: CanonicalFaceModel;
}

export function runFaceFeaturesPipeline(
  input: FaceFeaturesPipelineInput,
): FaceFeaturesPipelineResult {
  const geometry = runFaceGeometryPipeline(input);

  const shape = classifyFaceShape({
    eligible: geometry.eligibility.eligible,
    eligibilityReasons: geometry.eligibility.reasonCodes,
    anchors: input.anchors,
    trackingQuality: geometry.landmarks.trackingQuality,
  });

  const model = applyFaceShapeToCanonicalModel(geometry.model, shape);
  const findings = buildFaceFindings({
    model,
    shape,
    geometry: geometry.geometry,
  });

  return {
    ...geometry,
    model,
    shapeVersion: FACE_SHAPE_VERSION,
    shapeFormulaId: FACE_SHAPE_FORMULA_ID,
    shape,
    findings,
    limitations: [
      ...geometry.limitations.filter((l) => !l.includes('faceShape remains')),
      ...shape.limitations.slice(0, 3),
      `Face shape engine ${FACE_SHAPE_VERSION} / ${FACE_SHAPE_FORMULA_ID}`,
      `Findings count: ${findings.length}`,
    ],
  };
}
