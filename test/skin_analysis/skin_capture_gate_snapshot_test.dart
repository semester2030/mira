import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_gate_snapshot.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

void main() {
  group('SkinCaptureGateSnapshot', () {
    test('reports blocking gates when face missing', () {
      final snap = SkinCaptureGateSnapshot.fromLive(
        mirrorEnabled: false,
        cameraReady: true,
        captureInProgress: false,
        viewport: const Size(390, 700),
        frame: FaceMeshFrame(
          outline: const [],
          regions: const [],
          quality: FaceTrackingQuality.low,
          timestamp: DateTime.fromMillisecondsSinceEpoch(0),
        ),
        guidance: null,
      );

      expect(snap.canonicalReady, isFalse);
      expect(snap.blockingGateIds, contains('faceCount'));
      expect(snap.rows.any((r) => r.id == 'yaw' && !r.available), isTrue);
    });

    test('center/scale rows use FaceMeshQualityGate constants', () {
      expect(FaceMeshQualityGate.maxCenterDriftX, 0.13);
      expect(FaceMeshQualityGate.maxCenterDriftY, 0.11);
      expect(FaceMeshQualityGate.minFaceHeightRatio, 0.74);
      expect(FaceMeshQualityGate.maxFaceHeightRatio, 1.06);
    });
  });
}
