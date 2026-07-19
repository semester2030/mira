/// Phase 4B — Geometry pipeline wrapping foundation.
///
/// OWNERSHIP: Testing / Future offline mirror — NOT production execution.
/// Production: API `runFaceGeometryPipeline` only.
library;

import '../../../core/face_gate/face_gate_result.dart';
import '../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'face_client_mirror_gate.dart';
import 'face_foundation.dart';
import 'face_geometry_engine.dart';
import 'geometry_anchors.dart';

class FaceGeometryPipelineResult {
  final FaceFoundationResult foundation;
  final GeometryComputationResult geometry;
  final String geometryVersion;
  final String formulaId;

  const FaceGeometryPipelineResult({
    required this.foundation,
    required this.geometry,
    required this.geometryVersion,
    required this.formulaId,
  });
}

abstract final class FaceGeometryPipeline {
  FaceGeometryPipeline._();

  static FaceGeometryPipelineResult run({
    required FaceGateResult gate,
    FaceMeshFrame? meshFrame,
    bool? captureQualityAcceptable,
    GeometryAnchors? anchors,
    List<FaceMeshPoint>? landmarkList468,
  }) {
    FaceClientMirrorGate.assertMirrorAllowed('FaceGeometryPipeline');
    final foundation = FaceFoundationPipeline.run(
      gate: gate,
      meshFrame: meshFrame,
      captureQualityAcceptable: captureQualityAcceptable,
    );

    final resolvedAnchors = anchors ??
        (landmarkList468 != null
            ? GeometryAnchorExtractor.fromLandmarkList(landmarkList468)
            : null);

    final geometry = FaceGeometryEngine.compute(
      eligible: foundation.eligibility.eligible,
      eligibilityReasons: foundation.eligibility.reasonCodes,
      anchors: resolvedAnchors,
      trackingQuality: foundation.landmarks.trackingQuality,
    );

    final model = FaceGeometryEngine.applyToModel(foundation.model, geometry);

    return FaceGeometryPipelineResult(
      foundation: FaceFoundationResult(
        version: foundation.version,
        eligibility: foundation.eligibility,
        landmarks: foundation.landmarks,
        model: model,
        readyForGeometry: foundation.readyForGeometry,
        limitations: [
          ...foundation.limitations,
          ...geometry.limitations.take(3),
        ],
      ),
      geometry: geometry,
      geometryVersion: faceGeometryVersion,
      formulaId: faceGeometryFormulaId,
    );
  }
}
