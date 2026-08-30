import '../contracts/face_guidance_vms.dart';

/// Deterministic priority + cap (≤3, one primary).
abstract final class FaceGuidancePriorityPolicy {
  FaceGuidancePriorityPolicy._();

  static const maxItems = 3;

  static int categoryRank(String category) {
    switch (category) {
      case 'hairstyle':
        return 10;
      case 'makeup_contour':
        return 20;
      case 'eyewear':
        return 30;
      case 'accessories':
        return 40;
      case 'educational':
        return 90;
      default:
        return 100;
    }
  }

  static int sortKey(FaceGuidanceItemVm item) {
    // Lower is higher priority.
    final eligBoost = switch (item.eligibility) {
      FaceGuidanceEligibility.showPrimary => 0,
      FaceGuidanceEligibility.showSecondary => 100,
      FaceGuidanceEligibility.educationalOnly => 200,
      FaceGuidanceEligibility.detailOnly => 300,
      FaceGuidanceEligibility.hide || FaceGuidanceEligibility.block => 9000,
    };
    return eligBoost + item.priority;
  }

  static List<FaceGuidanceItemVm> selectTop(List<FaceGuidanceItemVm> items) {
    final visible = items
        .where(
          (i) =>
              i.eligibility == FaceGuidanceEligibility.showPrimary ||
              i.eligibility == FaceGuidanceEligibility.showSecondary ||
              i.eligibility == FaceGuidanceEligibility.educationalOnly,
        )
        .toList()
      ..sort((a, b) {
        final c = sortKey(a).compareTo(sortKey(b));
        if (c != 0) return c;
        return a.guidanceId.compareTo(b.guidanceId);
      });
    return visible.take(maxItems).toList(growable: false);
  }
}
