/**
 * Phase 4B — Face Geometry pipeline stage.
 *
 * JUSTIFICATION: Extends foundation; sole owner of ratio/thirds/symmetry computation.
 */

import { CanonicalFaceModel } from './canonical-face.model';
import {
  applyGeometryToCanonicalModel,
  computeFaceGeometry,
  FACE_GEOMETRY_FORMULA_ID,
  FACE_GEOMETRY_VERSION,
  GeometryComputationResult,
} from './geometry/face-geometry.engine';
import { GeometryAnchors } from './geometry/geometry-anchors';
import {
  FaceFoundationInput,
  FaceFoundationResult,
  runFaceFoundationPipeline,
} from './foundation.pipeline';

export interface FaceGeometryPipelineInput extends FaceFoundationInput {
  /** Normalized anchors from MediaPipe (extracted on-device). */
  anchors?: GeometryAnchors | null;
}

export interface FaceGeometryPipelineResult extends FaceFoundationResult {
  geometryVersion: typeof FACE_GEOMETRY_VERSION;
  formulaId: typeof FACE_GEOMETRY_FORMULA_ID;
  geometry: GeometryComputationResult;
  model: CanonicalFaceModel;
}

export function runFaceGeometryPipeline(
  input: FaceGeometryPipelineInput,
): FaceGeometryPipelineResult {
  const foundation = runFaceFoundationPipeline(input);

  const geometry = computeFaceGeometry({
    eligible: foundation.eligibility.eligible,
    eligibilityReasons: foundation.eligibility.reasonCodes,
    anchors: input.anchors,
    trackingQuality: foundation.landmarks.trackingQuality,
  });

  const model = applyGeometryToCanonicalModel(foundation.model, geometry);

  return {
    ...foundation,
    model,
    geometryVersion: FACE_GEOMETRY_VERSION,
    formulaId: FACE_GEOMETRY_FORMULA_ID,
    geometry,
    limitations: [
      ...foundation.limitations.filter((l) => !l.includes('not computed yet')),
      ...geometry.limitations.slice(0, 4),
      `Geometry engine ${FACE_GEOMETRY_VERSION} / ${FACE_GEOMETRY_FORMULA_ID}`,
    ],
  };
}
