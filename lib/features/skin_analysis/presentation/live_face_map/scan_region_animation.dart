import 'models/face_mesh_models.dart';

/// Sequential region scan — exactly one anatomical group visible at a time.
abstract final class ScanRegionAnimation {
  static const cycleSeconds = 2.6;
  static const cycleDuration = Duration(milliseconds: 2600);

  static const sweepSeconds = 1.2;
  static const sweepDuration = Duration(milliseconds: 1200);

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

  static FaceRegionId activeRegionId(double scanProgress) =>
      scanOrder[activeStepIndex(scanProgress)];

  static bool isRegionActive(FaceRegionId id, double scanProgress) =>
      activeRegionId(scanProgress) == id;
}
