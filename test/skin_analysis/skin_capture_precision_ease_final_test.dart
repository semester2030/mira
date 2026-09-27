import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_friction_telemetry.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_live_stabilizer.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_ux_policy.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

void main() {
  final guide = Rect.fromLTWH(50, 80, 200, 240);

  List<FaceRegionPolygon> fullRegions() => [
        for (final id in [
          FaceRegionId.forehead,
          FaceRegionId.underEye,
          FaceRegionId.nose,
          FaceRegionId.chin,
        ])
          FaceRegionPolygon(
            id: id,
            points: const [
              FaceMeshPoint(120, 140),
              FaceMeshPoint(160, 140),
              FaceMeshPoint(160, 180),
            ],
          ),
        const FaceRegionPolygon(
          id: FaceRegionId.cheek,
          isLeftSide: true,
          points: [
            FaceMeshPoint(60, 140),
            FaceMeshPoint(80, 150),
            FaceMeshPoint(70, 170),
          ],
        ),
        const FaceRegionPolygon(
          id: FaceRegionId.cheek,
          isLeftSide: false,
          points: [
            FaceMeshPoint(180, 140),
            FaceMeshPoint(200, 150),
            FaceMeshPoint(190, 170),
          ],
        ),
      ];

  FaceMeshFrame frame({
    required Rect box,
    double? yaw,
    double? pitch,
    double? roll,
  }) {
    return FaceMeshFrame(
      outline: List.generate(
        12,
        (i) => FaceMeshPoint(
          box.left + (box.width * (i % 4) / 3),
          box.top + (box.height * (i ~/ 4) / 2),
        ),
      ),
      regions: fullRegions(),
      boundingBox: box,
      quality: FaceTrackingQuality.high,
      yawDegrees: yaw ?? 0,
      pitchDegrees: pitch ?? 0,
      rollDegrees: roll ?? 0,
      timestamp: DateTime.now(),
    );
  }

  group('gate classification', () {
    test('critical / guidance / soft-exit sets', () {
      expect(SkinCaptureUxPolicy.isCriticalReason('mesh_yaw'), isTrue);
      expect(SkinCaptureUxPolicy.isGuidanceReason('face_off_center'), isTrue);
      expect(SkinCaptureUxPolicy.isSoftExitEligible('face_off_center'), isTrue);
      expect(SkinCaptureUxPolicy.isSoftExitEligible('mesh_yaw'), isTrue);
      expect(
        SkinCaptureUxPolicy.isSoftExitEligible('mesh_region_missing'),
        isFalse,
      );
    });
  });

  group('safe centering envelope', () {
    test('entry accepts readiness-aligned envelope', () {
      expect(FaceMeshQualityGate.maxCenterDriftX, 0.13);
      expect(FaceMeshQualityGate.maxCenterDriftY, 0.11);
      final ok = Rect.fromCenter(
        center: Offset(
          guide.center.dx + guide.width * 0.12,
          guide.center.dy,
        ),
        width: guide.width * 0.9,
        height: guide.height * 0.9,
      );
      expect(FaceMeshQualityGate.evaluate(frame(box: ok), guide).isAccepted,
          isTrue);
    });

    test('centerY instruction guides phone, not head tilt', () {
      final low = Rect.fromCenter(
        center: Offset(
          guide.center.dx,
          guide.center.dy + guide.height * 0.2,
        ),
        width: guide.width * 0.9,
        height: guide.height * 0.9,
      );
      final r = FaceMeshQualityGate.evaluate(frame(box: low), guide);
      expect(r.isAccepted, isFalse);
      expect(r.reasonCode, 'face_off_center');
      expect(r.messageAr, contains('ارفعي الهاتف'));
    });
  });

  group('instruction priority scale over center', () {
    test('too-far wins over simultaneous off-center', () {
      final farAndOff = Rect.fromCenter(
        center: Offset(
          guide.center.dx + guide.width * 0.2,
          guide.center.dy + guide.height * 0.2,
        ),
        width: guide.width * 0.5,
        height: guide.height * 0.5,
      );
      final r = FaceMeshQualityGate.evaluate(frame(box: farAndOff), guide);
      expect(r.reasonCode, 'face_too_far');
      expect(r.messageAr, contains('قرّبي'));
    });
  });

  group('READY hysteresis stabilizer', () {
    test('soft center exit keeps accepted after READY', () {
      final stab = SkinCaptureLiveStabilizer();
      final good = Rect.fromCenter(
        center: guide.center,
        width: guide.width * 0.9,
        height: guide.height * 0.9,
      );
      expect(stab.evaluate(frame(box: good), guide).isAccepted, isTrue);
      final soft = Rect.fromCenter(
        center: Offset(
          guide.center.dx +
              guide.width * (FaceMeshQualityGate.maxCenterDriftX + 0.01),
          guide.center.dy,
        ),
        width: guide.width * 0.9,
        height: guide.height * 0.9,
      );
      expect(stab.evaluate(frame(box: soft), guide).isAccepted, isTrue);
    });

    test('material yaw beyond exit band resets', () {
      final stab = SkinCaptureLiveStabilizer();
      final good = Rect.fromCenter(
        center: guide.center,
        width: guide.width * 0.9,
        height: guide.height * 0.9,
      );
      expect(stab.evaluate(frame(box: good), guide).isAccepted, isTrue);
      final bad = stab.evaluate(
        frame(box: good, yaw: FaceMeshQualityGate.maxYawDegrees + 5),
        guide,
      );
      expect(bad.isAccepted, isFalse);
      expect(bad.reasonCode, 'mesh_yaw');
    });
  });

  group('friction telemetry', () {
    test('ranks dominant blocker by dwell', () {
      final t = SkinCaptureFrictionTelemetry();
      final t0 = DateTime.utc(2026, 9, 11, 15);
      for (var i = 0; i < 10; i++) {
        t.record(
          reasonCode: 'face_off_center',
          isReady: false,
          now: t0.add(Duration(milliseconds: i * 50)),
        );
      }
      for (var i = 0; i < 3; i++) {
        t.record(
          reasonCode: 'face_too_far',
          isReady: false,
          now: t0.add(Duration(milliseconds: 500 + i * 50)),
        );
      }
      final snap = t.snapshotAndReset(now: t0.add(const Duration(seconds: 1)));
      expect(snap.rankedByDwell.first.reasonCode, 'face_off_center');
      expect(snap.notReadyFrames, 13);
    });
  });

  group('critical pose preserved', () {
    test('yaw entry ceiling unchanged at 15°', () {
      expect(FaceMeshQualityGate.maxYawDegrees, 15);
      expect(FaceMeshQualityGate.maxPitchDegrees, 15);
      expect(FaceMeshQualityGate.maxRollDegrees, 12);
      final good = Rect.fromCenter(
        center: guide.center,
        width: guide.width * 0.9,
        height: guide.height * 0.9,
      );
      expect(
        FaceMeshQualityGate.evaluate(frame(box: good, yaw: 16), guide)
            .isAccepted,
        isFalse,
      );
    });
  });
}
