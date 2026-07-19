/**
 * Phase 4D — Face Recommendations pipeline.
 *
 * JUSTIFICATION: Extends features; sole owner of face styling recommendations.
 * No report UI (4E). No Perfect product lock-in.
 */

import {
  FaceFeaturesPipelineInput,
  FaceFeaturesPipelineResult,
  runFaceFeaturesPipeline,
} from './features.pipeline';
import {
  assertFaceRecommendationEvidence,
  buildFaceRecommendations,
  FACE_RECOMMENDATION_ENGINE_ID,
  FACE_RECOMMENDATION_VERSION,
  FaceRecommendation,
} from './recommendation/face-recommendation.engine';

export interface FaceRecommendationPipelineInput
  extends FaceFeaturesPipelineInput {}

export interface FaceRecommendationPipelineResult
  extends FaceFeaturesPipelineResult {
  recommendationVersion: typeof FACE_RECOMMENDATION_VERSION;
  recommendationEngineId: typeof FACE_RECOMMENDATION_ENGINE_ID;
  recommendations: FaceRecommendation[];
}

export function runFaceRecommendationPipeline(
  input: FaceRecommendationPipelineInput,
): FaceRecommendationPipelineResult {
  const features = runFaceFeaturesPipeline(input);
  const recommendations = buildFaceRecommendations({
    model: features.model,
    findings: features.findings,
  });
  assertFaceRecommendationEvidence(recommendations);

  return {
    ...features,
    recommendationVersion: FACE_RECOMMENDATION_VERSION,
    recommendationEngineId: FACE_RECOMMENDATION_ENGINE_ID,
    recommendations,
    limitations: [
      ...features.limitations,
      `Face recommendations ${FACE_RECOMMENDATION_VERSION} / ${FACE_RECOMMENDATION_ENGINE_ID}`,
      `Recommendations count: ${recommendations.length}`,
      'No Perfect product lock-in.',
    ],
  };
}
