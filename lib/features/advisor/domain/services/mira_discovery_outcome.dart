/// Distinguishes «no catalog match» from «search could not run».
enum MiraDiscoveryOutcome {
  matched,
  noMatch,
  searchFailed,
}

class MiraDiscoveryOutcomeCopy {
  MiraDiscoveryOutcomeCopy._();

  static MiraDiscoveryOutcome classify({
    required bool searchFailed,
    required int offerCount,
  }) {
    if (searchFailed) return MiraDiscoveryOutcome.searchFailed;
    if (offerCount <= 0) return MiraDiscoveryOutcome.noMatch;
    return MiraDiscoveryOutcome.matched;
  }

  static String messageAr(MiraDiscoveryOutcome outcome) {
    switch (outcome) {
      case MiraDiscoveryOutcome.matched:
        return 'وجدتُ عروضًا منشورة من كتالوج ميرا.';
      case MiraDiscoveryOutcome.noMatch:
        return 'لم نجد مطابقًا في الكتالوج المنشور.';
      case MiraDiscoveryOutcome.searchFailed:
        return 'تعذّر البحث في الكتالوج الآن — ليست نتيجة «لا مطابق».';
    }
  }
}
