import '../contracts/face_guidance_vms.dart';

/// Ownership registry — presentation metadata only (not a knowledge DB).
abstract final class FaceGuidanceOwnershipPolicy {
  FaceGuidanceOwnershipPolicy._();

  /// Face Intelligence owned wire categories.
  static const faceOwnedCategories = <String>{
    'hairstyle',
    'makeup_contour',
    'eyewear',
    'accessories',
    'educational',
  };

  static FaceGuidanceOwner ownerForCategory(String category) {
    if (faceOwnedCategories.contains(category)) {
      return FaceGuidanceOwner.faceIntelligence;
    }
    return FaceGuidanceOwner.unsupported;
  }

  static bool isFaceOwned(String category) =>
      ownerForCategory(category) == FaceGuidanceOwner.faceIntelligence;

  /// Explicit cross-domain boundary (documentation + runtime guard).
  static const domainOwners = <String, FaceGuidanceOwner>{
    'face_structural_explanation': FaceGuidanceOwner.faceIntelligence,
    'face_styling_recommendation': FaceGuidanceOwner.faceIntelligence,
    'skin_treatment': FaceGuidanceOwner.skin,
    'fashion_style': FaceGuidanceOwner.fashion,
    'conversation_narration': FaceGuidanceOwner.advisor,
    'generic_beauty_tip': FaceGuidanceOwner.genericStatic,
  };
}
