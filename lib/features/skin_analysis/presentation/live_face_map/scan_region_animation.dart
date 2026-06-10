import 'dart:ui' show lerpDouble;

import 'models/face_mesh_models.dart';

/// Sequential scan — one anatomical region fades in/out at a time.
abstract final class ScanRegionAnimation {
  static const cycleSeconds = 2.6;
  static const cycleDuration = Duration(milliseconds: 2600);

  static const scanOrder = <FaceRegionId>[
    FaceRegionId.forehead,
    FaceRegionId.underEye,
    FaceRegionId.nose,
    FaceRegionId.cheek,
    FaceRegionId.chin,
  ];

  static int activeStepIndex(double scanProgress) {
    final cycle = scanProgress % 1.0;
    return (cycle * scanOrder.length).floor().clamp(0, scanOrder.length - 1);
  }

  /// Returns 0–1 strength for [id] at looping [scanProgress] (0–1).
  static double strengthFor(FaceRegionId id, double scanProgress) {
    final stepIndex = scanOrder.indexOf(id);
    if (stepIndex < 0) return 0;

    final count = scanOrder.length;
    final slot = 1.0 / count;
    final cycle = scanProgress % 1.0;
    final slotStart = stepIndex * slot;
    final slotEnd = (stepIndex + 1) * slot;

    if (cycle < slotStart || cycle >= slotEnd) return 0;

    final t = (cycle - slotStart) / slot;
    return _fadeEnvelope(t);
  }

  static double _fadeEnvelope(double t) {
    const fadeInEnd = 0.36;
    const holdEnd = 0.56;

    if (t < fadeInEnd) {
      final x = t / fadeInEnd;
      return lerpDouble(0, 1, _easeInOut(x))!;
    }
    if (t < holdEnd) return 1;
    final x = (t - holdEnd) / (1 - holdEnd);
    return lerpDouble(1, 0, _easeInOut(x))!;
  }

  static double _easeInOut(double t) {
    final clamped = t.clamp(0.0, 1.0);
    return clamped * clamped * (3 - 2 * clamped);
  }
}
