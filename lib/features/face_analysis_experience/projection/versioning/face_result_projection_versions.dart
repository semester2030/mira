/// Version pins for Face Result Projection (Phase 9E).
/// Does not modify Face Intelligence schema versions.
abstract final class FaceResultProjectionVersions {
  FaceResultProjectionVersions._();

  static const projection = 'face-result-projection-v1';
  static const executiveSummary = 'face-executive-summary-v1';
  static const primaryResult = 'face-primary-result-v1';
  static const insight = 'face-insight-v1';
  static const mirrorVm = 'face-result-mirror-vm-v1';
  static const numericPolicy = 'face-numeric-visibility-v1';
  static const forbiddenPolicy = 'face-forbidden-field-v1';
}
