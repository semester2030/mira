import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

void main() {
  group('FaceMeshQualityGate', () {
    final guide = Rect.fromLTWH(50, 80, 200, 240);

    FaceMeshFrame alignedFrame() {
      return FaceMeshFrame(
        outline: List.generate(
          12,
          (i) => FaceMeshPoint(100 + i * 5.0, 120 + i * 8.0),
        ),
        regions: [
          for (final id in [
            FaceRegionId.forehead,
            FaceRegionId.underEye,
            FaceRegionId.nose,
            FaceRegionId.cheek,
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
        ],
        quality: FaceTrackingQuality.high,
        boundingBox: Rect.fromCenter(
          center: guide.center,
          width: guide.width * 0.82,
          height: guide.height * 0.88,
        ),
        timestamp: DateTime.now(),
      );
    }

    test('accepts aligned frame with all regions', () {
      final result = FaceMeshQualityGate.evaluate(alignedFrame(), guide);
      expect(result.isAccepted, isTrue);
    });

    test('rejects when forehead region missing', () {
      final frame = alignedFrame();
      final regions = frame.regions
          .where((r) => r.id != FaceRegionId.forehead)
          .toList();
      final bad = FaceMeshFrame(
        outline: frame.outline,
        regions: regions,
        quality: frame.quality,
        boundingBox: frame.boundingBox,
        timestamp: frame.timestamp,
      );
      final result = FaceMeshQualityGate.evaluate(bad, guide);
      expect(result.isAccepted, isFalse);
      expect(result.reasonCode, 'mesh_region_missing');
    });

    test('rejects off-center face', () {
      final frame = alignedFrame();
      final bad = FaceMeshFrame(
        outline: frame.outline,
        regions: frame.regions,
        quality: frame.quality,
        boundingBox: Rect.fromCenter(
          center: Offset(guide.center.dx + 80, guide.center.dy),
          width: guide.width * 0.82,
          height: guide.height * 0.88,
        ),
        timestamp: frame.timestamp,
      );
      final result = FaceMeshQualityGate.evaluate(bad, guide);
      expect(result.isAccepted, isFalse);
      expect(result.reasonCode, 'face_off_center');
    });
  });
}
