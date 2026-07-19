import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:mirra/core/face_gate/face_gate_result.dart';
import 'package:mirra/features/face_intelligence/domain/canonical_face_model.dart';
import 'package:mirra/features/face_intelligence/domain/face_client_mirror_gate.dart';
import 'package:mirra/features/face_intelligence/domain/face_geometry_engine.dart';
import 'package:mirra/features/face_intelligence/domain/face_geometry_pipeline.dart';
import 'package:mirra/features/face_intelligence/domain/geometry_anchors.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';

GeometryAnchors frontalAnchors() => const GeometryAnchors(
      foreheadTop: NormPoint(0.5, 0.15),
      browMid: NormPoint(0.5, 0.32),
      noseTip: NormPoint(0.5, 0.52),
      noseBase: NormPoint(0.5, 0.58),
      chin: NormPoint(0.5, 0.88),
      leftEyeOuter: NormPoint(0.32, 0.35),
      leftEyeInner: NormPoint(0.42, 0.35),
      rightEyeInner: NormPoint(0.58, 0.35),
      rightEyeOuter: NormPoint(0.68, 0.35),
      leftMouth: NormPoint(0.4, 0.68),
      rightMouth: NormPoint(0.6, 0.68),
      leftFace: NormPoint(0.28, 0.5),
      rightFace: NormPoint(0.72, 0.5),
      leftAla: NormPoint(0.44, 0.55),
      rightAla: NormPoint(0.56, 0.55),
      leftJaw: NormPoint(0.34, 0.72),
      rightJaw: NormPoint(0.66, 0.72),
      source: 'synthetic_test',
    );

void main() {
  setUpAll(() {
    FaceClientMirrorGate.allowMirrorExecution = true;
  });
  tearDownAll(() {
    FaceClientMirrorGate.allowMirrorExecution = false;
  });

  group('Phase 4B — Face Geometry', () {
    final gate = FaceGateResult.acceptedWithFace(
      faceBox: const Rect.fromLTWH(10, 10, 100, 120),
      imageSize: const Size(400, 600),
      faceCount: 1,
      faceAreaRatio: 0.3,
      headYawDegrees: 0,
    );

    test('computes 4B metrics when eligible + anchors', () {
      final out = FaceGeometryPipeline.run(gate: gate, anchors: frontalAnchors());
      expect(out.geometryVersion, faceGeometryVersion);
      expect(out.formulaId, faceGeometryFormulaId);

      final byId = {
        for (final m in out.foundation.model.metrics) m.id: m,
      };
      expect(byId[CanonicalFaceMetricId.faceWidthHeightRatio]!.availability,
          'available');
      expect(byId[CanonicalFaceMetricId.symmetryCautious]!.availability,
          'available');
      expect(byId[CanonicalFaceMetricId.faceShape]!.availability, 'unavailable');
    });

    test('stays unavailable without anchors', () {
      final out = FaceGeometryPipeline.run(gate: gate);
      final geom = out.foundation.model.metrics
          .where((m) => m.id != CanonicalFaceMetricId.faceShape);
      expect(geom.every((m) => m.availability == 'unavailable'), isTrue);
    });

    test('rejects geometry when pose ineligible', () {
      final bad = const FaceGateResult.rejected(
        reasonCode: 'head_turned',
        messageAr: 'التفات',
        messageEn: 'turned',
      );
      final out =
          FaceGeometryPipeline.run(gate: bad, anchors: frontalAnchors());
      expect(out.foundation.eligibility.eligible, isFalse);
      expect(
        out.foundation.model.metrics
            .where((m) => m.id != CanonicalFaceMetricId.faceShape)
            .every((m) => m.availability == 'unavailable'),
        isTrue,
      );
    });

    test('extractor uses MediapipeLandmarkIndices owner constants', () {
      final list = List<FaceMeshPoint>.generate(
        468,
        (i) => FaceMeshPoint(i / 500, 0.2 + (i % 50) / 200),
      );
      // Place frontal-like values at owned indices
      void set(int i, double x, double y) => list[i] = FaceMeshPoint(x, y);
      set(MediapipeLandmarkIndices.geometryForeheadTop, 0.5, 0.15);
      set(MediapipeLandmarkIndices.geometryBrowMid, 0.5, 0.32);
      set(MediapipeLandmarkIndices.geometryNoseTip, 0.5, 0.52);
      set(MediapipeLandmarkIndices.geometryNoseBase, 0.5, 0.58);
      set(MediapipeLandmarkIndices.geometryChin, 0.5, 0.88);
      set(MediapipeLandmarkIndices.geometryLeftEyeOuter, 0.32, 0.35);
      set(MediapipeLandmarkIndices.geometryLeftEyeInner, 0.42, 0.35);
      set(MediapipeLandmarkIndices.geometryRightEyeInner, 0.58, 0.35);
      set(MediapipeLandmarkIndices.geometryRightEyeOuter, 0.68, 0.35);
      set(MediapipeLandmarkIndices.geometryLeftMouth, 0.4, 0.68);
      set(MediapipeLandmarkIndices.geometryRightMouth, 0.6, 0.68);
      set(MediapipeLandmarkIndices.geometryLeftFace, 0.28, 0.5);
      set(MediapipeLandmarkIndices.geometryRightFace, 0.72, 0.5);
      set(MediapipeLandmarkIndices.geometryLeftAla, 0.44, 0.55);
      set(MediapipeLandmarkIndices.geometryRightAla, 0.56, 0.55);
      set(MediapipeLandmarkIndices.geometryLeftJaw, 0.34, 0.72);
      set(MediapipeLandmarkIndices.geometryRightJaw, 0.66, 0.72);

      final anchors = GeometryAnchorExtractor.fromLandmarkList(list);
      expect(anchors, isNotNull);
      final g = FaceGeometryEngine.compute(
        eligible: true,
        eligibilityReasons: const [],
        anchors: anchors,
        trackingQuality: 'high',
      );
      expect(g.metrics.any((m) => m.availability == 'available'), isTrue);
    });

    test('deterministic for same anchors', () {
      final a = FaceGeometryEngine.compute(
        eligible: true,
        eligibilityReasons: const [],
        anchors: frontalAnchors(),
        trackingQuality: 'high',
      );
      final b = FaceGeometryEngine.compute(
        eligible: true,
        eligibilityReasons: const [],
        anchors: frontalAnchors(),
        trackingQuality: 'high',
      );
      expect(a.raw['widthHeight'], b.raw['widthHeight']);
      expect(
        a.metrics.first.normalizedValue,
        b.metrics.first.normalizedValue,
      );
    });

    test('thresholds pack unchanged', () {
      expect(CaptureQualityThresholds.version, 'cq-thresholds-v2.1');
      expect(CaptureQualityThresholds.maxYawDegrees, 35);
    });

    test('geomDist sanity', () {
      expect(geomDist(const NormPoint(0, 0), const NormPoint(3, 4)), 5);
      expect(math.sqrt(2), closeTo(geomDist(const NormPoint(0, 0), const NormPoint(1, 1)), 1e-9));
    });
  });
}
