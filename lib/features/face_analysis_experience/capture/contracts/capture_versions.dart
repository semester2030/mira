/// Version pins — Phase 9B capture contracts.
abstract final class FaceCaptureVersions {
  FaceCaptureVersions._();

  static const qualityInput = 'face-capture-quality-v1';
  static const readiness = 'face-capture-readiness-v1';
  static const guidance = 'face-capture-guidance-v1';
  static const policy = 'face-capture-policy-v1';
  static const holdWindow = 'face-capture-hold-v1';
  static const latch = 'face-capture-latch-v1';

  /// Presentation thresholds package (wraps cq-thresholds-v2.1 pose/area where shared).
  static const thresholdManifest = 'face-capture-thresholds-v1';
}
