import '../contracts/face_guidance_vms.dart';
import 'face_guidance_ownership_policy.dart';

/// Personalization + eligibility classification (strict).
abstract final class FaceGuidanceEligibilityPolicy {
  FaceGuidanceEligibilityPolicy._();

  static FaceGuidancePersonalizationLevel classify({
    required String category,
    required bool hasSource,
    required bool measurementEligible,
  }) {
    if (category == 'educational') {
      return FaceGuidancePersonalizationLevel.educational;
    }
    if (!FaceGuidanceOwnershipPolicy.isFaceOwned(category)) {
      return FaceGuidancePersonalizationLevel.general;
    }
    if (hasSource && measurementEligible) {
      return FaceGuidancePersonalizationLevel.personalized;
    }
    if (hasSource) {
      return FaceGuidancePersonalizationLevel.contextual;
    }
    return FaceGuidancePersonalizationLevel.general;
  }

  static FaceGuidanceEligibility eligibilityFor({
    required FaceGuidancePersonalizationLevel level,
    required FaceGuidanceOwner owner,
    required bool hasSource,
    required bool retakeRecommended,
    required bool lowConfidence,
  }) {
    if (owner == FaceGuidanceOwner.unsupported ||
        owner == FaceGuidanceOwner.genericStatic) {
      return FaceGuidanceEligibility.block;
    }
    if (retakeRecommended) {
      return FaceGuidanceEligibility.hide;
    }
    if (level == FaceGuidancePersonalizationLevel.personalized && !hasSource) {
      return FaceGuidanceEligibility.block;
    }
    if (level == FaceGuidancePersonalizationLevel.general) {
      return FaceGuidanceEligibility.hide;
    }
    if (level == FaceGuidancePersonalizationLevel.educational) {
      return lowConfidence
          ? FaceGuidanceEligibility.educationalOnly
          : FaceGuidanceEligibility.showSecondary;
    }
    if (lowConfidence) {
      return FaceGuidanceEligibility.showSecondary;
    }
    if (level == FaceGuidancePersonalizationLevel.personalized) {
      return FaceGuidanceEligibility.showPrimary;
    }
    return FaceGuidanceEligibility.showSecondary;
  }
}
