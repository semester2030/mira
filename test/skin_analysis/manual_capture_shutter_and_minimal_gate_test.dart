import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:mirra/core/face_gate/face_gate_rules.dart';
import 'package:mirra/features/face_analysis_experience/presentation/capture/geometry/capture_guide_geometry.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/post_capture_minimal_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

void main() {
  group('FaceMeshQualityGate.canTakePhoto (manual shutter)', () {
    FaceMeshFrame frame({
      required DateTime timestamp,
      FaceTrackingQuality quality = FaceTrackingQuality.high,
      Rect? box,
      int outlineCount = 12,
    }) {
      return FaceMeshFrame(
        outline: List.generate(
          outlineCount,
          (i) => FaceMeshPoint(40.0 + i, 50.0 + i),
        ),
        regions: const [],
        quality: quality,
        boundingBox: box ?? const Rect.fromLTWH(80, 100, 100, 140),
        timestamp: timestamp,
      );
    }

    test('true when face fresh and contained in capture guide', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      const preview = Size(300, 400);
      final guide = CaptureGuideGeometry.illustrativeOval(preview);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(
            timestamp: now,
            box: Rect.fromCenter(
              center: guide.center,
              width: guide.width * 0.55,
              height: guide.height * 0.55,
            ),
          ),
          previewSize: preview,
          captureArea: guide,
          now: now,
        ),
        isTrue,
      );
    });

    test('false when face only grazes preview (old 50% bug case)', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      const preview = Size(300, 400);
      final guide = CaptureGuideGeometry.illustrativeOval(preview);
      // Mostly outside the guide, but >50% still inside full preview.
      final box = Rect.fromLTWH(
        preview.width * 0.55,
        preview.height * 0.55,
        120,
        160,
      );
      expect(box.overlaps(Offset.zero & preview), isTrue);
      final previewHit = box.intersect(Offset.zero & preview);
      final previewOverlap =
          (previewHit.width * previewHit.height) / (box.width * box.height);
      expect(previewOverlap, greaterThan(0.5));
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(timestamp: now, box: box),
          previewSize: preview,
          captureArea: guide,
          now: now,
        ),
        isFalse,
      );
    });

    test('false when tracking quality is low', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      const preview = Size(300, 400);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(timestamp: now, quality: FaceTrackingQuality.low),
          previewSize: preview,
          captureArea: CaptureGuideGeometry.illustrativeOval(preview),
          now: now,
        ),
        isFalse,
      );
    });

    test('false when frame older than maxAge', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      const preview = Size(300, 400);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(timestamp: now.subtract(const Duration(milliseconds: 600))),
          previewSize: preview,
          captureArea: CaptureGuideGeometry.illustrativeOval(preview),
          now: now,
        ),
        isFalse,
      );
    });

    test('false when no face outline', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      const preview = Size(300, 400);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(timestamp: now, outlineCount: 2),
          previewSize: preview,
          captureArea: CaptureGuideGeometry.illustrativeOval(preview),
          now: now,
        ),
        isFalse,
      );
    });
  });

  group('FaceGateRules.evaluatePresenceAndArea', () {
    test('rejects zero / multiple faces and extreme area', () {
      expect(
        FaceGateRules.evaluatePresenceAndArea(
          faceCount: 0,
          faceAreaRatio: 0.2,
        ).reasonCode,
        'no_face',
      );
      expect(
        FaceGateRules.evaluatePresenceAndArea(
          faceCount: 2,
          faceAreaRatio: 0.2,
        ).reasonCode,
        'multiple_faces',
      );
      expect(
        FaceGateRules.evaluatePresenceAndArea(
          faceCount: 1,
          faceAreaRatio: 0.01,
        ).reasonCode,
        'face_too_small',
      );
      expect(
        FaceGateRules.evaluatePresenceAndArea(
          faceCount: 1,
          faceAreaRatio: 0.2,
        ).isAccepted,
        isTrue,
      );
    });

    test('full evaluate still rejects pose after presence passes', () {
      final r = FaceGateRules.evaluate(
        faceCount: 1,
        faceAreaRatio: 0.2,
        headYawDegrees: 50,
      );
      expect(r.isAccepted, isFalse);
      expect(r.reasonCode, 'head_turned');
    });
  });

  group('PostCaptureMinimalGate HD short side', () {
    test('rejects short side below 1080 with accurate Arabic (no move-closer)',
        () async {
      final dir = await Directory.systemTemp.createTemp('mira_pcmg_');
      addTearDown(() async {
        if (await dir.exists()) await dir.delete(recursive: true);
      });

      final tiny = img.Image(width: 640, height: 480);
      img.fill(tiny, color: img.ColorRgb8(180, 140, 120));
      final file = File('${dir.path}/tiny.jpg');
      await file.writeAsBytes(Uint8List.fromList(img.encodeJpg(tiny)));

      final result = await PostCaptureMinimalGate.validate(file);
      expect(result.isAccepted, isFalse);
      expect(result.reasonCode, 'resolution_below_hd');
      expect(result.messageAr, contains('1080'));
      expect(result.messageAr, isNot(contains('قرّبي')));
      expect(result.messageAr, contains('الاقتراب'));
    });

    test('hdMinShortSidePx matches Perfect HD contract', () {
      expect(PostCaptureMinimalGate.hdMinShortSidePx, 1080);
      expect(PostCaptureMinimalGate.hdMinShortSidePx, isNot(480));
    });
  });
}
