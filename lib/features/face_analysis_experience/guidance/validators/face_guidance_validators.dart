import '../contracts/face_guidance_vms.dart';

/// Rejects forbidden guidance concepts (presentation-level).
abstract final class FaceGuidanceValidators {
  FaceGuidanceValidators._();

  static const forbiddenPhrases = <String>[
    'Beauty Score',
    'Attractiveness Score',
    'Golden Ratio Beauty',
    'درجة جمال',
    'درجة جاذبية',
    'اصلحي وجهك',
    'عالجي',
    'اخفي العيب',
    'صححي وجهك',
    'اجعلي وجهك أجمل',
    'قللي عدم التناسق',
    'تشخيص',
    'عملية تجميل',
    'يجب عليكِ دائمًا',
  ];

  static void assertPublicSafe(FaceGuidanceSurfaceVm surface) {
    for (final item in surface.allItems) {
      assertOwner(item);
      assertPersonalizedHasSource(item);
      assertNoForbidden(item);
    }
  }

  static void assertOwner(FaceGuidanceItemVm item) {
    if (item.personalizationLevel ==
            FaceGuidancePersonalizationLevel.personalized &&
        item.owner != FaceGuidanceOwner.faceIntelligence) {
      throw StateError(
        'Personalized guidance requires Face Intelligence owner: ${item.guidanceId}',
      );
    }
  }

  static void assertPersonalizedHasSource(FaceGuidanceItemVm item) {
    if (item.personalizationLevel !=
        FaceGuidancePersonalizationLevel.personalized) {
      return;
    }
    final has = (item.frozenRecommendationRef?.isNotEmpty ?? false) &&
        ((item.sourceResultRef?.isNotEmpty ?? false) ||
            (item.sourceDetailRef?.isNotEmpty ?? false));
    if (!has) {
      throw StateError(
        'Personalized guidance missing source: ${item.guidanceId}',
      );
    }
  }

  static void assertNoForbidden(FaceGuidanceItemVm item) {
    final blob = '${item.titleAr} ${item.bodyAr} ${item.reason.explanationAr}';
    for (final f in forbiddenPhrases) {
      if (blob.contains(f)) {
        throw StateError(
          'Forbidden guidance phrase "$f" in ${item.guidanceId}',
        );
      }
    }
  }

  static bool containsForbidden(String text) {
    for (final f in forbiddenPhrases) {
      if (text.contains(f)) return true;
    }
    return false;
  }
}
