import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/ai/models/outfit_analysis_result.dart';
import '../../../intelligence/domain/entities/mira_style_report.dart';
import '../entities/outfit_capture_signals.dart';
import '../entities/outfit_score_result.dart';
import 'outfit_score_engine.dart';

/// Offline Mira Style Report — mirrors backend ingest-outfit + narrative.
abstract final class LocalStyleReportBuilder {
  LocalStyleReportBuilder._();

  static const disclaimerAr =
      'تقييم إرشادي للإطلالة بناءً على الصورة والمناسبة — وليس حكماً stylist نهائياً.';

  static MiraStyleReport fromOutfitResult(
    OutfitAnalysisResult outfit, {
    OutfitCaptureSignals captureQuality = const OutfitCaptureSignals.neutral(),
    int? previousScore,
  }) {
    final scored = OutfitScoreEngine.compute(
      outfit,
      captureQuality: captureQuality,
      previousScore: previousScore,
    );

    return MiraStyleReport(
      version: 1,
      outfitScore: scored.finalScore,
      confidence: scored.confidence,
      severityLevel: scored.severityLevel.labelAr,
      strongestIssueAr: scored.strongestIssueAr,
      improvementPotential: scored.improvementPotential,
      occasionReady: scored.occasionReady,
      styleCategoryAr: outfit.styleCategoryAr,
      styleCategoryEn: outfit.styleCategoryEn,
      garmentTypeAr: outfit.garmentTypeAr,
      colorCompatibilityAr: _colorCompatibilityLabel(scored.finalScore),
      dominantColorsAr: List<String>.from(outfit.dominantColors),
      alternativeLooksAr: outfit.alternativeColorsAr.take(5).toList(),
      occasionSuitabilityAr: _suitabilityAr(outfit.occasion, scored.finalScore),
      headlineAr: _headline(scored.finalScore),
      summaryAr:
          'تقييم الإطلالة ${scored.finalScore}/100 — ${outfit.styleCategoryAr} بألوان ${outfit.dominantColors.join(' · ')}.',
      styleTipsAr: _tips(scored, outfit.occasion),
      disclaimerAr: disclaimerAr,
    );
  }

  static String _headline(int score) {
    if (score >= 86) return 'إطلالة متقنة — جاهزة للمناسبة بثقة';
    if (score >= 76) return 'إطلالة جيدة — مع فرصة لتحسين بسيط';
    if (score >= 64) return 'إطلالة مقبولة — تحتاج ضبطاً لونياً أو رسمياً';
    if (score >= 48) return 'إطلالتك تحتاج إعادة توازن قبل المناسبة';
    return 'إطلالتك تحتاج تعديلاً واضحاً — ابدئي بالألوان والقصّة';
  }

  static String _colorCompatibilityLabel(int score) {
    if (score >= 85) return 'توافق لوني ممتاز';
    if (score >= 72) return 'توافق لوني جيد';
    if (score >= 58) return 'توافق لوني متوسط';
    return 'توافق لوني يحتاج تحسين';
  }

  static String _suitabilityAr(MiraOccasion occasion, int score) {
    final level = score >= 86
        ? 'ممتاز'
        : score >= 74
            ? 'مناسب جداً'
            : score >= 62
                ? 'مناسب'
                : score >= 48
                    ? 'يحتاج تحسين'
                    : 'غير مناسب حالياً';
    return '$level لمناسبة ${occasion.labelAr}';
  }

  static List<String> _tips(OutfitScoreResult score, MiraOccasion occasion) {
    final tips = <String>[
      switch (score.strongestIssueId) {
        'colorClash' =>
          'قلّلي عدد الألوان القوية — لون أساس + accent واحد يكفي.',
        'occasionMismatch' =>
          'لمناسبة ${occasion.labelAr}، اختاري قصّة وألوان أقرب للرسمية المطلوبة.',
        'tonalImbalance' =>
          'وازني بين الفاتح والغامق في الطبقات العلوية والسفلية.',
        'accessoryOverload' => 'اختاري إكسسواراً واحداً بارزاً بدل تعدد القطع.',
        'formalityGap' =>
          'ارفعي مستوى الرسمية: أحذية أنظف · قماش أقل casual · تفاصيل أبسط.',
        _ => 'ركّزي على لونين متناسقين وقصّة واضحة — النتيجة تتحسن بسرعة.',
      },
    ];
    if (score.finalScore < 70) {
      tips.add('صورة إطلالة كاملة بإضاءة نهارية ترفع دقة التحليل في المرة القادمة.');
    }
    return tips.take(4).toList();
  }
}
