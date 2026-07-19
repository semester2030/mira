/// Phase 4C — Features pipeline wrapping geometry (shape + findings).
///
/// OWNERSHIP: Testing / Future offline mirror — NOT production execution.
library;

import '../../../core/face_gate/face_gate_result.dart';
import '../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'canonical_face_model.dart';
import 'face_client_mirror_gate.dart';
import 'face_finding_engine.dart';
import 'face_geometry_pipeline.dart';
import 'face_shape_classifier.dart';
import 'geometry_anchors.dart';

class FaceFeaturesPipelineResult {
  final FaceGeometryPipelineResult geometry;
  final CanonicalFaceModel model;
  final FaceShapeClassification shape;
  final List<FaceFinding> findings;
  final String shapeVersion;
  final String shapeFormulaId;

  const FaceFeaturesPipelineResult({
    required this.geometry,
    required this.model,
    required this.shape,
    required this.findings,
    required this.shapeVersion,
    required this.shapeFormulaId,
  });
}

abstract final class FaceFeaturesPipeline {
  FaceFeaturesPipeline._();

  static FaceFeaturesPipelineResult run({
    required FaceGateResult gate,
    FaceMeshFrame? meshFrame,
    bool? captureQualityAcceptable,
    GeometryAnchors? anchors,
    List<FaceMeshPoint>? landmarkList468,
  }) {
    FaceClientMirrorGate.assertMirrorAllowed('FaceFeaturesPipeline');
    final geo = FaceGeometryPipeline.run(
      gate: gate,
      meshFrame: meshFrame,
      captureQualityAcceptable: captureQualityAcceptable,
      anchors: anchors,
      landmarkList468: landmarkList468,
    );

    final resolvedAnchors = anchors ??
        (landmarkList468 != null
            ? GeometryAnchorExtractor.fromLandmarkList(landmarkList468)
            : null);

    final shape = FaceShapeClassifier.classify(
      eligible: geo.foundation.eligibility.eligible,
      eligibilityReasons: geo.foundation.eligibility.reasonCodes,
      anchors: resolvedAnchors,
      trackingQuality: geo.foundation.landmarks.trackingQuality,
    );

    final model =
        FaceShapeClassifier.applyToModel(geo.foundation.model, shape);
    final findings = FaceFindingEngine.build(
      model: model,
      shape: shape,
      geometry: geo.geometry,
    );

    return FaceFeaturesPipelineResult(
      geometry: geo,
      model: model,
      shape: shape,
      findings: findings,
      shapeVersion: faceShapeVersion,
      shapeFormulaId: faceShapeFormulaId,
    );
  }
}
