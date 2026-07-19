import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:mirra/core/face_gate/face_gate_result.dart';
import 'package:mirra/features/face_intelligence/domain/canonical_face_model.dart';
import 'package:mirra/features/face_intelligence/domain/face_client_mirror_gate.dart';
import 'package:mirra/features/face_intelligence/domain/face_foundation.dart';
import 'package:mirra/features/face_intelligence/domain/landmark_frame_summary.dart';
import 'package:mirra/features/face_intelligence/domain/measurement_eligibility.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_tracking_quality.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

void main() {
  setUpAll(() {
    FaceClientMirrorGate.allowMirrorExecution = true;
  });
  tearDownAll(() {
    FaceClientMirrorGate.allowMirrorExecution = false;
  });

  group('Phase 4A — Face Foundation', () {
    test('eligibility reuses cq-thresholds-v2.1 via FaceGateRules', () {
      final gate = FaceGateResult.acceptedWithFace(
        faceBox: const Rect.fromLTWH(10, 10, 100, 120),
        imageSize: const Size(400, 600),
        faceCount: 1,
        faceAreaRatio: 0.25,
        headYawDegrees: 4,
        headPitchDegrees: 2,
        headRollDegrees: 1,
      );
      final e = MeasurementEligibility.fromFaceGate(
        gate,
        captureQualityAcceptable: true,
      );
      expect(e.eligible, isTrue);
      expect(e.thresholdVersion, CaptureQualityThresholds.version);
      expect(e.thresholdVersion, 'cq-thresholds-v2.1');
    });

    test('rejects turned head using same yaw limit', () {
      final gate = const FaceGateResult.rejected(
        reasonCode: 'head_turned',
        messageAr: 'التفات',
        messageEn: 'turned',
      );
      final e = MeasurementEligibility.fromFaceGate(gate);
      expect(e.eligible, isFalse);
      expect(e.reasonCodes, contains('head_turned'));
    });

    test('skeleton metrics never invent values', () {
      final model = CanonicalFaceModelFactory.skeleton(
        measurementEligible: true,
        eligibilityReasonCodes: const [],
      );
      expect(model.metrics.length, CanonicalFaceMetricId.values.length);
      for (final m in model.metrics) {
        expect(m.availability, 'unavailable');
        expect(m.normalizedValue, isNull);
        expect(m.confidence, 0);
        expect(m.displayNameAr, isNotEmpty);
        expect(m.displayNameEn, isNotEmpty);
      }
    });

    test('landmark mapper reuses FaceMeshFrame without inventing mesh', () {
      final empty = LandmarkFrameMapper.fromMeshFrame(null);
      expect(empty.usableForFutureGeometry, isFalse);

      final frame = FaceMeshFrame(
        outline: List.generate(16, (i) => FaceMeshPoint(i.toDouble(), 0)),
        regions: [
          FaceRegionPolygon(
            id: FaceRegionId.nose,
            points: [
              const FaceMeshPoint(0, 0),
              const FaceMeshPoint(1, 0),
              const FaceMeshPoint(1, 1),
            ],
          ),
        ],
        quality: FaceTrackingQuality.high,
        timestamp: DateTime.utc(2026, 1, 1),
      );
      final summary = LandmarkFrameMapper.fromMeshFrame(frame);
      expect(summary.hasOutline, isTrue);
      expect(summary.regionIdsPresent, contains('nose'));
      expect(summary.source, 'mediapipe_mesh');
    });

    test('foundation pipeline readyForGeometry only when eligible + mesh', () {
      final gate = FaceGateResult.acceptedWithFace(
        faceBox: const Rect.fromLTWH(10, 10, 100, 120),
        imageSize: const Size(400, 600),
        faceCount: 1,
        faceAreaRatio: 0.3,
        headYawDegrees: 0,
      );
      final frame = FaceMeshFrame(
        outline: List.generate(16, (i) => FaceMeshPoint(i.toDouble(), 1)),
        regions: const [],
        quality: FaceTrackingQuality.medium,
        timestamp: DateTime.utc(2026, 1, 1),
      );
      final withMesh = FaceFoundationPipeline.run(gate: gate, meshFrame: frame);
      expect(withMesh.readyForGeometry, isTrue);
      expect(
        withMesh.model.metrics.every((m) => m.availability == 'unavailable'),
        isTrue,
      );

      final noMesh = FaceFoundationPipeline.run(gate: gate);
      expect(noMesh.readyForGeometry, isFalse);
    });

    test('limitations forbid attractiveness scoring as a product claim', () {
      final gate = const FaceGateResult.accepted();
      final out = FaceFoundationPipeline.run(gate: gate);
      final blob = out.limitations.join(' ').toLowerCase();
      expect(blob.contains('not attractiveness'), isTrue);
      expect(RegExp(r'\battractiveness score\b').hasMatch(blob), isFalse);
    });
  });
}
