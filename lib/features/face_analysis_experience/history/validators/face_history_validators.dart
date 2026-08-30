import '../contracts/face_history_vms.dart';

/// Fail-closed comparability + structural wording validators.
abstract final class FaceHistoryValidators {
  FaceHistoryValidators._();

  static void assertMayRender(FaceComparisonVm vm) {
    if (vm.gate == FaceComparabilityGate.notComparable &&
        vm.comparableItems.isNotEmpty) {
      throw StateError('NOT_COMPARABLE comparison must not render items');
    }
  }

  static void assertNoProgressLanguage(FaceComparisonVm vm) {
    final blob = [
      vm.comparisonReasonAr,
      ...vm.limitationsAr,
      for (final i in vm.comparableItems) ...[
        i.userLanguageAr,
        i.currentPresentationAr,
        i.previousPresentationAr,
      ],
    ].join(' ');
    for (final f in const [
      'تحسن',
      'تراجع',
      'أجمل',
      'أسوأ',
      'درجة جمال',
      'Beauty Score',
      'Attractiveness',
    ]) {
      if (blob.contains(f)) {
        throw StateError('Forbidden progress language "$f"');
      }
    }
  }

  static void assertStructuralNeverImproved(FaceComparisonItemVm item) {
    if (item.comparabilityClass != FaceComparabilityClass.structural) return;
    final bad = item.userLanguageAr.contains('تحسن') ||
        item.userLanguageAr.contains('تراجع');
    if (bad) {
      throw StateError('Structural item must not use progress wording');
    }
  }
}
