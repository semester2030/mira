/// Phase 4A — Face Foundation assemble (Flutter).
///
/// OWNERSHIP: Testing / Future offline mirror — NOT production execution.
/// Production Face Intelligence: API `runFaceFoundationPipeline` only.
/// See docs/architecture/flutter_face_engine_ownership.md
library;

import '../../../core/face_gate/face_gate_result.dart';
import '../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'canonical_face_model.dart';
import 'face_client_mirror_gate.dart';
import 'landmark_frame_summary.dart';
import 'measurement_eligibility.dart';

class FaceFoundationResult {
  final String version;
  final MeasurementEligibilityResult eligibility;
  final LandmarkFrameSummary landmarks;
  final CanonicalFaceModel model;
  final bool readyForGeometry;
  final List<String> limitations;

  const FaceFoundationResult({
    required this.version,
    required this.eligibility,
    required this.landmarks,
    required this.model,
    required this.readyForGeometry,
    required this.limitations,
  });
}

abstract final class FaceFoundationPipeline {
  FaceFoundationPipeline._();

  static FaceFoundationResult run({
    required FaceGateResult gate,
    FaceMeshFrame? meshFrame,
    bool? captureQualityAcceptable,
  }) {
    FaceClientMirrorGate.assertMirrorAllowed('FaceFoundationPipeline');
    final eligibility = MeasurementEligibility.fromFaceGate(
      gate,
      captureQualityAcceptable: captureQualityAcceptable,
    );
    final landmarks = LandmarkFrameMapper.fromMeshFrame(meshFrame);
    final model = CanonicalFaceModelFactory.skeleton(
      measurementEligible: eligibility.eligible,
      eligibilityReasonCodes: eligibility.reasonCodes,
    );
    final ready = eligibility.eligible && landmarks.usableForFutureGeometry;

    return FaceFoundationResult(
      version: faceFoundationVersion,
      eligibility: eligibility,
      landmarks: landmarks,
      model: model,
      readyForGeometry: ready,
      limitations: [
        ...model.limitations,
        if (!eligibility.eligible)
          'Not eligible — all face metrics unavailable.'
        else
          'Eligible for Phase 4B geometry — not computed yet.',
      ],
    );
  }
}
