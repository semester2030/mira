/// Phase 4D — Recommendations pipeline wrapping features.
///
/// OWNERSHIP: Testing / Future offline mirror — NOT production execution.
library;

import '../../../core/face_gate/face_gate_result.dart';
import '../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'face_client_mirror_gate.dart';
import 'face_features_pipeline.dart';
import 'face_recommendation_engine.dart';
import 'geometry_anchors.dart';

class FaceRecommendationPipelineResult {
  final FaceFeaturesPipelineResult features;
  final List<FaceRecommendation> recommendations;
  final String recommendationVersion;
  final String recommendationEngineId;

  const FaceRecommendationPipelineResult({
    required this.features,
    required this.recommendations,
    required this.recommendationVersion,
    required this.recommendationEngineId,
  });
}

abstract final class FaceRecommendationPipeline {
  FaceRecommendationPipeline._();

  static FaceRecommendationPipelineResult run({
    required FaceGateResult gate,
    FaceMeshFrame? meshFrame,
    bool? captureQualityAcceptable,
    GeometryAnchors? anchors,
    List<FaceMeshPoint>? landmarkList468,
  }) {
    FaceClientMirrorGate.assertMirrorAllowed('FaceRecommendationPipeline');
    final features = FaceFeaturesPipeline.run(
      gate: gate,
      meshFrame: meshFrame,
      captureQualityAcceptable: captureQualityAcceptable,
      anchors: anchors,
      landmarkList468: landmarkList468,
    );

    final recommendations = FaceRecommendationEngine.build(
      model: features.model,
      findings: features.findings,
    );

    return FaceRecommendationPipelineResult(
      features: features,
      recommendations: recommendations,
      recommendationVersion: faceRecommendationVersion,
      recommendationEngineId: faceRecommendationEngineId,
    );
  }
}
