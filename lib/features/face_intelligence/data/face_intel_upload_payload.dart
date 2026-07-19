/// Phase 4.5 / Operational Hardening — Serialize faceIntel for production upload.
///
/// Always includes explicit [FaceIntelRuntimeState] — never silent omission.
library;

import 'dart:convert';

import '../../../core/face_gate/face_gate_result.dart';
import '../domain/face_intel_runtime_state.dart';
import '../domain/geometry_anchors.dart';

/// Result of building the multipart faceIntel field (never silently empty).
class FaceIntelUploadBundle {
  final FaceIntelRuntimeState runtime;
  final String json;

  const FaceIntelUploadBundle({required this.runtime, required this.json});
}

/// Builds the multipart `faceIntel` JSON string for POST /ai/skin-analysis.
abstract final class FaceIntelUploadPayload {
  FaceIntelUploadPayload._();

  static Map<String, dynamic> poseFromGate(
    FaceGateResult gate, {
    required bool captureQualityAcceptable,
  }) {
    return <String, dynamic>{
      if (gate.faceCount != null) 'faceCount': gate.faceCount,
      if (gate.faceAreaRatio != null) 'faceAreaRatio': gate.faceAreaRatio,
      if (gate.headYawDegrees != null) 'headYawDegrees': gate.headYawDegrees,
      if (gate.headPitchDegrees != null) 'headPitchDegrees': gate.headPitchDegrees,
      if (gate.headRollDegrees != null) 'headRollDegrees': gate.headRollDegrees,
      if (gate.centerOffsetXRatio != null)
        'centerOffsetXRatio': gate.centerOffsetXRatio,
      if (gate.centerOffsetYRatio != null)
        'centerOffsetYRatio': gate.centerOffsetYRatio,
      'facePresent': gate.isAccepted,
      'captureQualityAcceptable': captureQualityAcceptable,
    };
  }

  static Map<String, dynamic> anchorsToJson(GeometryAnchors a) {
    Map<String, double> pt(NormPoint p) => {'x': p.x, 'y': p.y};
    return <String, dynamic>{
      'version': a.version,
      'foreheadTop': pt(a.foreheadTop),
      'browMid': pt(a.browMid),
      'noseTip': pt(a.noseTip),
      'noseBase': pt(a.noseBase),
      'chin': pt(a.chin),
      'leftEyeOuter': pt(a.leftEyeOuter),
      'leftEyeInner': pt(a.leftEyeInner),
      'rightEyeInner': pt(a.rightEyeInner),
      'rightEyeOuter': pt(a.rightEyeOuter),
      'leftMouth': pt(a.leftMouth),
      'rightMouth': pt(a.rightMouth),
      'leftFace': pt(a.leftFace),
      'rightFace': pt(a.rightFace),
      'leftAla': pt(a.leftAla),
      'rightAla': pt(a.rightAla),
      'leftJaw': pt(a.leftJaw),
      'rightJaw': pt(a.rightJaw),
      'source': a.source,
    };
  }

  /// Always returns a bundle with explicit runtime (never silent null).
  static FaceIntelUploadBundle build({
    required FaceGateResult gate,
    required bool captureQualityAcceptable,
    required FaceIntelRuntimeState runtime,
    GeometryAnchors? anchors,
    int pointCount = 0,
    String trackingQuality = 'low',
  }) {
    final pose = poseFromGate(
      gate,
      captureQualityAcceptable: captureQualityAcceptable,
    );

    final map = <String, dynamic>{
      'runtime': runtime.toJson(),
      'pose': pose,
      'landmarks': <String, dynamic>{
        'pointCount': pointCount,
        'hasOutline': pointCount >= 8,
        'trackingQuality': trackingQuality,
        'source': pointCount >= 8 ? 'mediapipe_mesh' : 'unavailable',
      },
      if (anchors != null) 'anchors': anchorsToJson(anchors),
      'captureVersion': 'cq-thresholds-v2.1',
      'provider': 'on_device_landmarks',
    };

    return FaceIntelUploadBundle(runtime: runtime, json: jsonEncode(map));
  }
}
