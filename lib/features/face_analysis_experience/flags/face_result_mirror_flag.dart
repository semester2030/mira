import '../../../core/config/mira_features.dart';
import '../../../core/entitlements/mira_runtime_entitlement_store.dart';

/// Phase 9F — Interactive Result Mirror rollout gate.
///
/// BUILD ∩ RUNTIME (server `faceExperienceV1`). Fail-closed.
abstract final class FaceResultMirrorFlag {
  FaceResultMirrorFlag._();

  static bool get enabled =>
      MiraFeatures.faceResultMirrorV1 &&
      MiraRuntimeEntitlementStore.faceExperienceV1;
}
