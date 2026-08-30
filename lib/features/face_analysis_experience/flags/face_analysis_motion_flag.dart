import '../../../core/config/mira_features.dart';
import '../../../core/entitlements/mira_runtime_entitlement_store.dart';

/// Phase 9D — Soft Laser / Analysis Motion rollout gate.
///
/// BUILD ∩ RUNTIME (server `faceExperienceV1`). Fail-closed.
abstract final class FaceAnalysisMotionFlag {
  FaceAnalysisMotionFlag._();

  static bool get enabled =>
      MiraFeatures.faceAnalysisMotionV1 &&
      MiraRuntimeEntitlementStore.faceExperienceV1;
}
