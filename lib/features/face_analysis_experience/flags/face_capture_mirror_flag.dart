import '../../../core/config/mira_features.dart';
import '../../../core/entitlements/mira_runtime_entitlement_store.dart';

/// Phase 9C — Interactive Capture Mirror rollout gate.
///
/// BUILD inclusion: `MiraFeatures.faceCaptureMirrorV1` (dart-define).
/// RUNTIME authority: server entitlement `faceExperienceV1` (fail-closed).
/// Both required. Compile-time alone must not enable production UI.
abstract final class FaceCaptureMirrorFlag {
  FaceCaptureMirrorFlag._();

  static bool get enabled =>
      MiraFeatures.faceCaptureMirrorV1 &&
      MiraRuntimeEntitlementStore.faceExperienceV1;
}
