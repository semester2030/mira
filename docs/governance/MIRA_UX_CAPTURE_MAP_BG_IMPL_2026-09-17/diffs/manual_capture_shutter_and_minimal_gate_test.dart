import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:mirra/core/face_gate/face_gate_rules.dart';
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
        boundingBox: box ?? const Rect.fromLTWH(40, 60, 120, 160),
        timestamp: timestamp,
      );
    }

    test('true when face fresh and mostly inside preview', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(timestamp: now),
          previewSize: const Size(300, 400),
          now: now,
        ),
        isTrue,
      );
    });

    test('false when tracking quality is low', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(timestamp: now, quality: FaceTrackingQuality.low),
          previewSize: const Size(300, 400),
          now: now,
        ),
        isFalse,
      );
    });

    test('false when frame older than maxAge', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(timestamp: now.subtract(const Duration(milliseconds: 600))),
          previewSize: const Size(300, 400),
          now: now,
        ),
        isFalse,
      );
    });

    test('false when face mostly outside preview', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(
            timestamp: now,
            box: const Rect.fromLTWH(280, 350, 120, 160),
          ),
          previewSize: const Size(300, 400),
          now: now,
        ),
        isFalse,
      );
    });

    test('false when no face outline', () {
      final now = DateTime.utc(2026, 9, 17, 12, 0, 0);
      expect(
        FaceMeshQualityGate.canTakePhoto(
          frame(timestamp: now, outlineCount: 2),
          previewSize: const Size(300, 400),
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
    test('rejects decode / short side below 1080 without calling provider', () async {
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
    });

    test('hdMinShortSidePx matches Perfect HD contract', () {
      expect(PostCaptureMinimalGate.hdMinShortSidePx, 1080);
      expect(PostCaptureMinimalGate.hdMinShortSidePx, isNot(480));
    });
  });
}
