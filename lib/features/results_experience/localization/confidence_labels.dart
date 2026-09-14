import '../contracts/result_enums.dart';

class ConfidencePresentationSpec {
  const ConfidencePresentationSpec({
    required this.state,
    required this.labelAr,
    required this.explanationAr,
    required this.allowedClaimStrength,
    required this.numericVisible,
    required this.retakeEligible,
    required this.detailVisible,
  });

  final ConfidenceState state;
  final String labelAr;
  final String explanationAr;
  /// 0–3 claim strength budget for public copy.
  final int allowedClaimStrength;
  final bool numericVisible;
  final bool retakeEligible;
  final bool detailVisible;
}

abstract final class ConfidencePresentationContract {
  static const high = ConfidencePresentationSpec(
    state: ConfidenceState.high,
    labelAr: 'ثقة عالية',
    explanationAr: 'الإشارات كافية لعرض هذه النتيجة بوضوح.',
    allowedClaimStrength: 3,
    numericVisible: false,
    retakeEligible: false,
    detailVisible: true,
  );

  static const medium = ConfidencePresentationSpec(
    state: ConfidenceState.medium,
    labelAr: 'ثقة متوسطة',
    explanationAr: 'النتيجة مفيدة مع تحفظ — قد تختلف باختلاف الصورة.',
    allowedClaimStrength: 2,
    numericVisible: false,
    retakeEligible: false,
    detailVisible: true,
  );

  static const low = ConfidencePresentationSpec(
    state: ConfidenceState.low,
    labelAr: 'ثقة محدودة',
    explanationAr: 'نعرض تقديراً بحذر. إعادة التحليل قد توضح الصورة.',
    allowedClaimStrength: 1,
    numericVisible: false,
    retakeEligible: true,
    detailVisible: true,
  );

  static const unavailable = ConfidencePresentationSpec(
    state: ConfidenceState.unavailable,
    labelAr: 'ثقة غير متاحة',
    explanationAr: 'لا تتوفر ثقة كافية لعرض ادعاء قوي.',
    allowedClaimStrength: 0,
    numericVisible: false,
    retakeEligible: true,
    detailVisible: false,
  );

  static ConfidencePresentationSpec forState(ConfidenceState state) {
    switch (state) {
      case ConfidenceState.high:
        return high;
      case ConfidenceState.medium:
        return medium;
      case ConfidenceState.low:
        return low;
      case ConfidenceState.unavailable:
        return unavailable;
    }
  }

  static ConfidenceState fromLegacyLevel(String? level) {
    switch ((level ?? '').toLowerCase().trim()) {
      case 'high':
      case 'عالية':
        return ConfidenceState.high;
      case 'medium':
      case 'متوسطة':
        return ConfidenceState.medium;
      case 'low':
      case 'منخفضة':
      case 'محدودة':
        return ConfidenceState.low;
      default:
        return ConfidenceState.unavailable;
    }
  }

  static ConfidenceState fromPercent(int? percent) {
    if (percent == null) return ConfidenceState.unavailable;
    if (percent >= 75) return ConfidenceState.high;
    if (percent >= 50) return ConfidenceState.medium;
    if (percent > 0) return ConfidenceState.low;
    return ConfidenceState.unavailable;
  }
}
