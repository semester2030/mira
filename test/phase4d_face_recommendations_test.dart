import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/face_gate/face_gate_result.dart';
import 'package:mirra/features/face_intelligence/domain/face_client_mirror_gate.dart';
import 'package:mirra/features/face_intelligence/domain/face_features_pipeline.dart';
import 'package:mirra/features/face_intelligence/domain/face_recommendation_engine.dart';
import 'package:mirra/features/face_intelligence/domain/face_recommendation_pipeline.dart';
import 'package:mirra/features/face_intelligence/domain/face_shape_classifier.dart';
import 'package:mirra/features/face_intelligence/domain/geometry_anchors.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart';

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

  group('Phase 4D — Face Recommendations', () {
    final gate = FaceGateResult.acceptedWithFace(
      faceBox: const Rect.fromLTWH(10, 10, 100, 120),
      imageSize: const Size(400, 600),
      faceCount: 1,
      faceAreaRatio: 0.3,
      headYawDegrees: 0,
    );

    test('evidence-backed styling recos for oval', () {
      final out =
          FaceRecommendationPipeline.run(gate: gate, anchors: ovalAnchors());
      expect(out.recommendationVersion, faceRecommendationVersion);
      expect(out.recommendationEngineId, faceRecommendationEngineId);
      expect(
        out.recommendations.any((r) => r.id == 'edu_face_styling_disclaimer'),
        isTrue,
      );
      expect(
        out.recommendations.any((r) => r.id == 'rec_hairstyle_oval'),
        isTrue,
      );
      expect(out.features.shape.shapeId, FaceShapeId.oval);
      for (final r in out.recommendations) {
        expect(r.cosmeticOnly, isTrue);
        expect(r.productLockIn, isFalse);
      }
    });

    test('heart gets contour + accessories path', () {
      final out =
          FaceRecommendationPipeline.run(gate: gate, anchors: heartAnchors());
      expect(out.features.shape.shapeId, FaceShapeId.heart);
      expect(
        out.recommendations.any((r) => r.id == 'rec_contour_heart'),
        isTrue,
      );
      expect(
        out.recommendations.any((r) => r.id == 'rec_hairstyle_heart'),
        isTrue,
      );
    });

    test('ineligible yields disclaimer only', () {
      const bad = FaceGateResult.rejected(
        reasonCode: 'head_turned',
        messageAr: 'التفات',
        messageEn: 'turned',
      );
      final out =
          FaceRecommendationPipeline.run(gate: bad, anchors: ovalAnchors());
      expect(out.recommendations.length, 1);
      expect(out.recommendations.single.id, 'edu_face_styling_disclaimer');
    });

    test('features pipeline does not emit recommendations', () {
      final feat =
          FaceFeaturesPipeline.run(gate: gate, anchors: ovalAnchors());
      // Features result has findings/shape only — recommendations via 4D pipeline.
      expect(feat.findings, isNotEmpty);
      expect(feat.shape.availability, 'available');
    });

    test('non-educational reco requires evidence', () {
      final out =
          FaceRecommendationPipeline.run(gate: gate, anchors: ovalAnchors());
      for (final r in out.recommendations) {
        if (r.id == 'edu_face_styling_disclaimer') continue;
        expect(
          r.evidence.findingIds.isNotEmpty || r.evidence.metricIds.isNotEmpty,
          isTrue,
          reason: r.id,
        );
      }
    });

    test('thresholds pack unchanged', () {
      expect(CaptureQualityThresholds.version, 'cq-thresholds-v2.1');
    });
  });
}
