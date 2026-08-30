import '../contracts/capture_versions.dart';

/// Hold-still window for AUTO_CAPTURE_ELIGIBLE (timestamp-based, not frame count).
abstract final class FaceCaptureHoldWindowPolicy {
  FaceCaptureHoldWindowPolicy._();

  static const version = FaceCaptureVersions.holdWindow;

  /// Candidate after FPS analysis: ~500ms covers mid-tier 15–30fps without feeling laggy.
  static const Duration defaultHold = Duration(milliseconds: 500);

  static bool isHoldSatisfied({
    required DateTime? readySince,
    required DateTime now,
    Duration hold = defaultHold,
  }) {
    if (readySince == null) return false;
    return !now.difference(readySince).isNegative &&
        now.difference(readySince) >= hold;
  }
}
