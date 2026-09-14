import '../../intelligence/domain/entities/mira_beauty_report.dart';
import '../contracts/result_presentation_vms.dart';
import '../localization/public_language_policy.dart';
import 'skin_truth_class.dart';

/// Presentation claim gate — what may appear on the main Skin Interactive report.
abstract final class SkinClaimPolicy {
  SkinClaimPolicy._();

  /// Skin Map geometry verdict — Perfect provider masks are spatial truth.
  static const mapTruthVerdict = 'PROVIDER_PIXEL_MASK';
  static const mapTruthClass = SkinTruthClass.measured;

  /// Forbidden strong age / future claims on the main consumer surface.
  static const forbiddenMainClaimFragments = <String>[
    'بشرتك تبدو',
    'أصغر بـ',
    'أكبر بـ',
    'هدفنا',
    'هدفنا القادم',
    'تحسن متوقع',
    'خلال 30 يوماً',
    'خلال 30 يوم',
    'provider_measured',
    'locally_calculated',
    'raw=',
  ];

  static bool containsForbiddenMainClaim(String text) {
    final t = text.trim();
    if (t.isEmpty) return false;
    for (final f in forbiddenMainClaimFragments) {
      if (t.contains(f)) return true;
    }
    return PublicLanguagePolicy.validate(t, field: 'skin_main').isNotEmpty;
  }

  /// Skin age number may exist as DERIVED estimate — never as primary comparison.
  static bool allowSkinAgeOnMain(ResultExperience experience) => false;

  static bool allowSkinAgeInTransparency(ResultSkinAgeVM skinAge) {
    return skinAge.estimateYears != null && skinAge.eligibleForSecondary;
  }

  /// 30-day linear projection only in Journey, clearly as estimate — never as goal.
  static bool allowLinearProjectionInJourney(ResultProgressPreviewVM progress) {
    return progress.projectionVisible && progress.projectionEstimate != null;
  }

  static String? linearProjectionCopyAr(ResultProgressPreviewVM progress) {
    if (!allowLinearProjectionInJourney(progress)) return null;
    final n = progress.projectionEstimate!;
    return 'تقدير خطي فقط: إن استمر نفس اتجاه المؤشر قد يقترب من $n خلال نحو 30 يوماً — '
        'وليس وعداً بتحسن بيولوجي ولا هدفاً علاجياً.';
  }

  static String mapPrecisionDisclaimerAr() =>
      'أقنعة الاكتشاف على صورتك — بدون خطوط مرسومة.';

  static SkinTruthClass metricTruthClass({required bool evidenceAvailable}) {
    if (!evidenceAvailable) return SkinTruthClass.unavailable;
    return SkinTruthClass.measured;
  }

  static SkinTruthClass vitalityTruthClass() => SkinTruthClass.derived;

  /// Strip journey headlines that smuggle motivational unsupported targets.
  static String sanitizeJourneyHeadlineAr(String raw) {
    if (containsForbiddenMainClaim(raw) || raw.contains('هدف')) {
      return 'رحلة بشرتك — مقارنة تاريخية عند توفر تحليلين متوافقين';
    }
    return PublicLanguagePolicy.sanitize(raw);
  }

  static bool hasFaceGeometryNoise(MiraBeautyReport mira) {
    final face = mira.faceIntelligence;
    return face != null &&
        (face.recommendations.isNotEmpty ||
            face.metrics.isNotEmpty ||
            face.executiveSummaryAr.isNotEmpty);
  }
}
