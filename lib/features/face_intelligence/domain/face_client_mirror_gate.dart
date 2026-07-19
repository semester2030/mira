/// Operational Hardening — gate accidental production use of Flutter Face mirrors.
///
/// Production Face Intelligence report execution is API-owned
/// (`runFaceReportPipeline`). Flutter domain pipelines are Testing / Future
/// offline mirrors only.
library;

/// Prevents Flutter Face*Pipeline / engine mirrors from running in production.
abstract final class FaceClientMirrorGate {
  FaceClientMirrorGate._();

  /// Tests and explicit offline experiments must set this true before calling
  /// Flutter Face Foundation/Geometry/Features/Recommendation pipelines.
  static bool allowMirrorExecution = false;

  /// Call at the start of every Flutter Face*Pipeline.run / engine entry that
  /// mirrors the API (not GeometryAnchorExtractor / upload bridge).
  static void assertMirrorAllowed(String component) {
    if (allowMirrorExecution) return;
    throw StateError(
      'Face client mirror "$component" is not a production execution path. '
      'Production Face Intelligence runs only on the API via runFaceReportPipeline. '
      'Set FaceClientMirrorGate.allowMirrorExecution = true only in tests or '
      'approved offline experiments. See docs/architecture/flutter_face_engine_ownership.md',
    );
  }
}
