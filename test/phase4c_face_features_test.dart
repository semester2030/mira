import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/face_gate/face_gate_result.dart';
import 'package:mirra/features/face_intelligence/domain/canonical_face_model.dart';
import 'package:mirra/features/face_intelligence/domain/face_client_mirror_gate.dart';
import 'package:mirra/features/face_intelligence/domain/face_features_pipeline.dart';
import 'package:mirra/features/face_intelligence/domain/face_geometry_pipeline.dart';
import 'package:mirra/features/face_intelligence/domain/face_shape_classifier.dart';
import 'package:mirra/features/face_intelligence/domain/geometry_anchors.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';

GeometryAnchors ovalAnchors() => const GeometryAnchors(
      foreheadTop: NormPoint(0.5, 0.22),
      browMid: NormPoint(0.5, 0.34),
      noseTip: NormPoint(0.5, 0.52),
      noseBase: NormPoint(0.5, 0.58),
      chin: NormPoint(0.5, 0.78),
      leftEyeOuter: NormPoint(0.31, 0.36),
      leftEyeInner: NormPoint(0.42, 0.36),
      rightEyeInner: NormPoint(0.58, 0.36),
      rightEyeOuter: NormPoint(0.69, 0.36),
      leftMouth: NormPoint(0.4, 0.68),
      rightMouth: NormPoint(0.6, 0.68),
      leftFace: NormPoint(0.29, 0.5),
      rightFace: NormPoint(0.71, 0.5),
      leftAla: NormPoint(0.44, 0.55),
      rightAla: NormPoint(0.56, 0.55),
      leftJaw: NormPoint(0.325, 0.72),
      rightJaw: NormPoint(0.675, 0.72),
      source: 'synthetic_test',
    );

GeometryAnchors heartAnchors() => const GeometryAnchors(
      foreheadTop: NormPoint(0.5, 0.22),
      browMid: NormPoint(0.5, 0.34),
      noseTip: NormPoint(0.5, 0.52),
      noseBase: NormPoint(0.5, 0.58),
      chin: NormPoint(0.5, 0.78),
      leftEyeOuter: NormPoint(0.27, 0.36),
      leftEyeInner: NormPoint(0.42, 0.36),
      rightEyeInner: NormPoint(0.58, 0.36),
      rightEyeOuter: NormPoint(0.73, 0.36),
      leftMouth: NormPoint(0.4, 0.68),
      rightMouth: NormPoint(0.6, 0.68),
      leftFace: NormPoint(0.3, 0.5),
      rightFace: NormPoint(0.7, 0.5),
      leftAla: NormPoint(0.44, 0.55),
      rightAla: NormPoint(0.56, 0.55),
      leftJaw: NormPoint(0.39, 0.72),
      rightJaw: NormPoint(0.61, 0.72),
      source: 'synthetic_test',
    );

void main() {
  setUpAll(() {
    FaceClientMirrorGate.allowMirrorExecution = true;
  });
  tearDownAll(() {
    FaceClientMirrorGate.allowMirrorExecution = false;
  });

  group('Phase 4C — Face Features', () {
    final gate = FaceGateResult.acceptedWithFace(
      faceBox: const Rect.fromLTWH(10, 10, 100, 120),
      imageSize: const Size(400, 600),
      faceCount: 1,
      faceAreaRatio: 0.3,
      headYawDegrees: 0,
    );

    test('classifies oval + findings when eligible', () {
      final out = FaceFeaturesPipeline.run(gate: gate, anchors: ovalAnchors());
      expect(out.shapeVersion, faceShapeVersion);
      expect(out.shapeFormulaId, faceShapeFormulaId);
      expect(out.shape.availability, 'available');
      expect(out.shape.shapeId, FaceShapeId.oval);

      final faceShape = out.model.metrics
          .firstWhere((m) => m.id == CanonicalFaceMetricId.faceShape);
      expect(faceShape.availability, 'available');
      expect(faceShape.categoricalValue, 'oval');
      expect(out.findings.any((f) => f.id == 'face_shape_oval'), isTrue);
    });

    test('heart class from hybrid ratios', () {
      final shape = FaceShapeClassifier.classify(
        eligible: true,
        eligibilityReasons: const [],
        anchors: heartAnchors(),
        trackingQuality: 'high',
      );
      expect(shape.availability, 'available');
      expect(shape.shapeId, FaceShapeId.heart);
    });

    test('geometry pipeline still leaves faceShape awaiting 4C', () {
      final geo =
          FaceGeometryPipeline.run(gate: gate, anchors: ovalAnchors());
      final faceShape = geo.foundation.model.metrics
          .firstWhere((m) => m.id == CanonicalFaceMetricId.faceShape);
      expect(faceShape.availability, 'unavailable');
      expect(faceShape.unavailableReason, 'awaiting_face_shape_engine_4c');
    });

    test('unavailable when pose ineligible', () {
      const bad = FaceGateResult.rejected(
        reasonCode: 'head_turned',
        messageAr: 'التفات',
        messageEn: 'turned',
      );
      final out =
          FaceFeaturesPipeline.run(gate: bad, anchors: ovalAnchors());
      expect(out.shape.availability, 'unavailable');
      expect(out.findings, isEmpty);
    });

    test('jaw indices owned by MediapipeLandmarkIndices', () {
      expect(MediapipeLandmarkIndices.geometryLeftJaw, 172);
      expect(MediapipeLandmarkIndices.geometryRightJaw, 397);
      expect(
        MediapipeLandmarkIndices.geometryAnchorIndices,
        contains(MediapipeLandmarkIndices.geometryLeftJaw),
      );
    });

    test('thresholds pack unchanged', () {
      expect(CaptureQualityThresholds.version, 'cq-thresholds-v2.1');
    });

    test('deterministic for same anchors', () {
      final a = FaceShapeClassifier.classify(
        eligible: true,
        eligibilityReasons: const [],
        anchors: ovalAnchors(),
        trackingQuality: 'high',
      );
      final b = FaceShapeClassifier.classify(
        eligible: true,
        eligibilityReasons: const [],
        anchors: ovalAnchors(),
        trackingQuality: 'high',
      );
      expect(a.shapeId, b.shapeId);
      expect(a.confidence, b.confidence);
      expect(a.signals['wh'], b.signals['wh']);
    });
  });
}
