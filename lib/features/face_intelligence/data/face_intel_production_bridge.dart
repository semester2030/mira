/// Operational Hardening — Build faceIntel upload JSON after capture quality gate.
///
/// Never silently returns null: always emits explicit [FaceIntelRuntimeState].
library;

import 'dart:io';

import '../../../core/face_gate/face_gate_result.dart';
import '../../skin_analysis/presentation/live_face_map/face_mesh_service.dart';
import '../domain/face_intel_runtime_state.dart';
import '../domain/geometry_anchors.dart';
import 'face_intel_upload_payload.dart';

abstract final class FaceIntelProductionBridge {
  FaceIntelProductionBridge._();

  /// Extracts anchors and builds upload JSON with explicit runtime status.
  static Future<FaceIntelUploadBundle> buildUploadBundle({
    required File alignedImage,
    required FaceGateResult faceGate,
    required bool captureQualityAcceptable,
    FaceMeshService? meshService,
  }) async {
    GeometryAnchors? anchors;
    var pointCount = 0;
    var trackingQuality = 'low';
    FaceIntelRuntimeState runtime;

    final owned = meshService == null;
    final mesh = meshService ?? FaceMeshService();
    try {
      final extracted = await mesh.extractFaceIntelLandmarks(alignedImage);
      if (extracted == null) {
        runtime = FaceIntelRuntimeState.unavailable(
          reason: 'mediapipe_no_mesh',
          stage: 'mediapipe',
          confidence: 25,
        );
      } else {
        anchors = extracted.anchors;
        pointCount = extracted.pointCount;
        trackingQuality = extracted.trackingQuality;
        if (anchors == null) {
          runtime = FaceIntelRuntimeState.unavailable(
            reason: 'anchors_extraction_incomplete',
            stage: 'anchors',
            confidence: 35,
          );
        } else {
          runtime = FaceIntelRuntimeState.available(
            stage: 'anchors',
            confidence: trackingQuality == 'high'
                ? 92
                : trackingQuality == 'medium'
                    ? 75
                    : 55,
          );
        }
      }
    } catch (e) {
      runtime = FaceIntelRuntimeState.failed(
        reason: 'mediapipe_exception',
        stage: 'mediapipe',
      );
    } finally {
      if (owned) {
        await mesh.dispose();
      }
    }

    return FaceIntelUploadPayload.build(
      gate: faceGate,
      captureQualityAcceptable: captureQualityAcceptable,
      runtime: runtime,
      anchors: anchors,
      pointCount: pointCount,
      trackingQuality: trackingQuality,
    );
  }
}
