import '../../../../core/ai/mappers/skin_result_mapper.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../skin_analysis/domain/services/skin_report_matrix.dart';
import '../entities/beauty_journey.dart';
import '../entities/confidence_layer.dart';
import '../entities/mira_beauty_report.dart';
import '../entities/concern_zones_section.dart';
import '../services/local_face_map_builder.dart';
import '../entities/progress_forecast.dart';
import 'local_age_intelligence.dart';
import 'local_beauty_journey_builder.dart';
import 'local_confidence_layer_builder.dart';
import 'local_weekly_plan_builder.dart';

/// Offline fallback — mirrors backend engines for guest / legacy reports.
abstract final class LocalMiraReportBuilder {
  LocalMiraReportBuilder._();

  static MiraBeautyReport fromSkinReport(
    SkinReport report, {
    int? birthYear,
    bool isGuest = false,
  }) {
    final result = SkinResultMapper.fromReport(report);
    final score = result.beautyScore.round().clamp(0, 100);
    final rawSkinAge = report.skinAge ?? SkinReportMatrix.skinAge(report);
    final safety = LocalAgeIntelligence.applyChildSafety(
      birthYear: birthYear,
      skinAge: rawSkinAge,
    );
    final concerns = LocalAgeIntelligence.filterConcerns(
      _concerns(report),
      safety,
    );
    final ageComparison = LocalAgeIntelligence.buildComparison(
      birthYear: birthYear,
      skinAge: safety.isMinor ? null : rawSkinAge,
      safety: safety,
      concernIds: concerns.map((c) => c.id).toList(),
      isGuest: isGuest,
    );

    final concernZones = _concernZones(report);
    final faceHealthMap = LocalFaceMapBuilder.fromSkinReport(report);
    final dailyRoutine = _routine(report);
    final weeklyPlan = LocalWeeklyPlanBuilder.fromSkinReport(report, dailyRoutine);

    final base = MiraBeautyReport(
      version: 1,
      spatialConfidence: 'none',
      overallBeautyScore: score,
      headlineAr: _headline(score),
      skinTypeAr: report.skinType.isNotEmpty ? report.skinType : 'غير محدد',
      skinTypeEn: report.skinTypeEn.isNotEmpty ? report.skinTypeEn : 'unknown',
      skinAgeEstimate: safety.isMinor ? null : rawSkinAge,
      ageComparison: ageComparison,
      childSafety: safety,
      mainConcerns: concerns,
      dailyRoutine: dailyRoutine,
      summaryAdviceAr: report.advice.isNotEmpty
          ? report.advice
          : 'اتبعي روتينك اليومي بثبات — النتائج تحتاج وقتاً وصبراً.',
      tipsAr: report.recommendations.isNotEmpty
          ? report.recommendations.take(5).toList()
          : const [
              'روتين يومي: تنظيف لطيف، ترطيب، وواقي شمس.',
              'اشربي ماء كافياً — الترطيب يبدأ من الداخل.',
            ],
      faceMapEnabled: false,
      concernZonesSection: concernZones,
      faceHealthMap: faceHealthMap,
      concernZonesNarrative: faceHealthMap.enabled
          ? faceHealthMap.insightCards.map((c) => c.bodyAr).toList()
          : concernZones.zones.map((z) => z.narrativeAr).toList(),
      recommendedProducts: const [],
      weeklyPlan: weeklyPlan,
      progressForecast: ProgressForecast.empty,
      beautyJourney: BeautyJourney.empty(score),
      confidenceLayer: ConfidenceLayer.empty,
    );

    final journey = LocalBeautyJourneyBuilder.fromReport(base);
    final withJourney = MiraBeautyReport(
      version: base.version,
      spatialConfidence: base.spatialConfidence,
      overallBeautyScore: base.overallBeautyScore,
      headlineAr: base.headlineAr,
      skinTypeAr: base.skinTypeAr,
      skinTypeEn: base.skinTypeEn,
      skinAgeEstimate: base.skinAgeEstimate,
      ageComparison: base.ageComparison,
      childSafety: base.childSafety,
      mainConcerns: base.mainConcerns,
      dailyRoutine: base.dailyRoutine,
      summaryAdviceAr: base.summaryAdviceAr,
      tipsAr: base.tipsAr,
      faceMapEnabled: base.faceMapEnabled,
      concernZonesSection: base.concernZonesSection,
      faceHealthMap: base.faceHealthMap,
      concernZonesNarrative: base.concernZonesNarrative,
      recommendedProducts: base.recommendedProducts,
      weeklyPlan: base.weeklyPlan,
      progressForecast: base.progressForecast,
      beautyJourney: journey,
      confidenceLayer: ConfidenceLayer.empty,
    );

    return MiraBeautyReport(
      version: withJourney.version,
      spatialConfidence: withJourney.spatialConfidence,
      overallBeautyScore: withJourney.overallBeautyScore,
      headlineAr: withJourney.headlineAr,
      skinTypeAr: withJourney.skinTypeAr,
      skinTypeEn: withJourney.skinTypeEn,
      skinAgeEstimate: withJourney.skinAgeEstimate,
      ageComparison: withJourney.ageComparison,
      childSafety: withJourney.childSafety,
      mainConcerns: withJourney.mainConcerns,
      dailyRoutine: withJourney.dailyRoutine,
      summaryAdviceAr: withJourney.summaryAdviceAr,
      tipsAr: withJourney.tipsAr,
      faceMapEnabled: withJourney.faceMapEnabled,
      concernZonesSection: withJourney.concernZonesSection,
      faceHealthMap: withJourney.faceHealthMap,
      concernZonesNarrative: withJourney.concernZonesNarrative,
      recommendedProducts: withJourney.recommendedProducts,
      weeklyPlan: withJourney.weeklyPlan,
      progressForecast: withJourney.progressForecast,
      beautyJourney: journey,
      confidenceLayer: LocalConfidenceLayerBuilder.fromReport(withJourney),
    );
  }

  static String _headline(int score) {
    if (score >= 82) {
      return 'بشرتك في حالة جيدة — نكمل معاً على روتين يحافظ على توازنها.';
    }
    if (score >= 68) {
      return 'بشرتك تحتاج عناية مركّزة — خطة ميرا اليومية تناسبك.';
    }
    return 'بشرتك تستحق اهتماماً إضافياً — ابدئي بالخطوات البسيطة أدناه.';
  }

  static List<ConcernNarrative> _concerns(SkinReport report) {
    final scores = SkinReportMatrix.matrixScores(report);
    final byId = {for (final c in scores) c.id: c.score};

    int ui(String id, int fallback) => byId[id] ?? fallback;

    final items = <ConcernNarrative>[
      _n('moisture', 'الترطيب', ui('moisture', report.hydration)),
      _n('oiliness', 'إفراز الدهون', ui('oiliness', 100 - report.oiliness)),
      _n('pore', 'المسام', ui('pore', 100 - report.pores * 20)),
      _n('wrinkle', 'التجاعيد', ui('wrinkle', 100 - report.wrinkles * 20)),
      _n('acne', 'الحبوب', ui('acne', 100 - report.acne * 20)),
      _n('age_spot', 'التصبغات', ui('age_spot', 100 - report.spots * 20)),
      _n('redness', 'الاحمرار', ui('redness', 100 - report.redness * 20)),
    ];

    final actionable = items
        .where((c) => c.severity != 'none')
        .toList()
      ..sort((a, b) => _rank(b.severity).compareTo(_rank(a.severity)));

    if (actionable.length >= 3) return actionable.take(5).toList();

    final positives = items.where((c) => c.severity == 'none').take(2);
    return [...actionable, ...positives].take(5).toList();
  }

  static ConcernNarrative _n(String id, String title, int uiScore) {
    final severity = _severity(uiScore);
    return ConcernNarrative(
      id: id,
      titleAr: title,
      narrativeAr: _narrative(id, severity),
      severity: severity,
    );
  }

  static String _severity(int uiScore) {
    if (uiScore >= 78) return 'none';
    if (uiScore >= 65) return 'mild';
    if (uiScore >= 50) return 'moderate';
    return 'noticeable';
  }

  static int _rank(String severity) {
    switch (severity) {
      case 'noticeable':
        return 4;
      case 'moderate':
        return 3;
      case 'mild':
        return 2;
      default:
        return 1;
    }
  }

  static String _narrative(String id, String severity) {
    const map = {
      'moisture': {
        'none': 'مستوى الترطيب متوازن — بشرتك تحتفظ بالرطوبة بشكل جيد.',
        'mild': 'نلاحظ احتياجاً بسيطاً للترطيب — كريم يومي خفيف يساعد.',
        'moderate': 'البشرة تحتاج ترطيباً أوضح — ركزي على سيروم أو كريم غني.',
        'noticeable': 'جفاف واضح — اجعلي الترطيب خطوة أساسية صباحاً ومساءً.',
      },
      'oiliness': {
        'none': 'إفراز الدهون متوازن — لا مبالغة في اللمعان أو الجفاف.',
        'mild': 'زيادة بسيطة في الدهون — منظف لطيف يساعد.',
        'moderate': 'نلاحظ زيادة في إفراز الدهون — منتجات oil-free أنسب لك.',
        'noticeable': 'دهنية ملحوظة — روتين توازن الدهون ضروري يومياً.',
      },
      'pore': {
        'none': 'المسام غير بارزة — مظهر ناعم ومتجانس.',
        'mild': 'المسام ظاهرة بدرجة خفيفة — تنظيف لطيف يحافظ على الوضوح.',
        'moderate': 'المسام ظاهرة بدرجة متوسطة وتحتاج عناية منتظمة.',
        'noticeable': 'المسام بارزة — مقشر BHA خفيف 1–2 مرات أسبوعياً قد يساعد.',
      },
      'wrinkle': {
        'none': 'لا توجد مؤشرات قوية على التجاعيد حالياً.',
        'mild': 'خطوط دقيقة طفيفة — واقي الشمس يومياً أمر أساسي.',
        'moderate': 'علامات بداية تجاعيد — ترطيب + SPF يبطئان التطور.',
        'noticeable': 'تجاعيد أو خطوط واضحة — روتين مضاد للشيخوخة مناسب.',
      },
      'acne': {
        'none': 'لا مؤشرات واضحة على الحبوب — البشرة هادئة.',
        'mild': 'بثور أو حبوب خفيفة — تجنبي لمس الوجه واستخدمي منظفاً لطيفاً.',
        'moderate': 'حبوب متوسطة — نياسيناميد أو BPO خفيف بعد استشارة.',
        'noticeable': 'حبوب ملحوظة — روتين مخصص للحبوب مع متابعة.',
      },
      'age_spot': {
        'none': 'لون البشرة متجانس نسبياً — لا تصبغات بارزة.',
        'mild': 'بقع خفيفة — SPF يمنع تفاقمها.',
        'moderate': 'تصبغات متوسطة — فيتامين C صباحاً قد يساعد تدريجياً.',
        'noticeable': 'تصبغات واضحة — خطة توحيد لون تحتاج صبراً وثباتاً.',
      },
      'redness': {
        'none': 'البشرة هادئة — لا احمرار ملحوظ.',
        'mild': 'احمرار خفيف — تجنبي الحرارة والمنتجات القاسية.',
        'moderate': 'احمرار متوسط — مرطبات مهدئة مناسبة لك.',
        'noticeable': 'احمرار واضح — روتين مهدئ بدون عطور أو كحول.',
      },
    };
    return map[id]?[severity] ?? 'نلاحظ احتياجاً للعناية في هذا المحور.';
  }

  static DailyRoutinePlan _routine(SkinReport report) {
    final scores = {for (final c in SkinReportMatrix.matrixScores(report)) c.id: c.score};
    final moisture = scores['moisture'] ?? report.hydration;
    final oilinessUi = scores['oiliness'] ?? (100 - report.oiliness);
    final oilinessHigh = oilinessUi < 55;
    final acne = scores['acne'] ?? (100 - report.acne * 20);
    final redness = scores['redness'] ?? (100 - report.redness * 20);
    final pores = scores['pore'] ?? (100 - report.pores * 20);

    final morning = <RoutineStep>[
      RoutineStep(
        id: 'cleanser_am',
        nameAr: oilinessHigh ? 'غسول توازن الدهون' : 'غسول لطيف',
        nameEn: oilinessHigh ? 'Balancing Cleanser' : 'Gentle Cleanser',
        stepAr: 'صباحاً — 30 ثانية بلطف',
        period: 'am',
      ),
    ];

    if (moisture < 62) {
      morning.add(const RoutineStep(
        id: 'serum_am',
        nameAr: 'سيروم ترطيب',
        nameEn: 'Hydrating Serum',
        stepAr: 'بعد الغسول — طبقة خفيفة',
        period: 'am',
      ));
    }

    morning.add(const RoutineStep(
      id: 'sunscreen',
      nameAr: 'واقي شمس SPF 50',
      nameEn: 'SPF 50 Sunscreen',
      stepAr: 'آخر خطوة صباحاً — كل يوم',
      period: 'am',
    ));

    final evening = <RoutineStep>[
      const RoutineStep(
        id: 'cleanser_pm',
        nameAr: 'غسول مسائي',
        nameEn: 'Evening Cleanser',
        stepAr: 'مساءً — إزالة الشوائب',
        period: 'pm',
      ),
    ];

    if (acne < 58) {
      evening.add(const RoutineStep(
        id: 'treatment_acne',
        nameAr: 'معالجة الحبوب (نياسيناميد)',
        nameEn: 'Niacinamide Treatment',
        stepAr: 'مساءً — على المناطق المتأثرة',
        period: 'pm',
      ));
    } else if (pores < 58) {
      evening.add(const RoutineStep(
        id: 'treatment_pores',
        nameAr: 'مقشر BHA خفيف',
        nameEn: 'Light BHA Exfoliant',
        stepAr: '2–3 مرات أسبوعياً — مساءً',
        period: 'pm',
      ));
    }

    if (redness < 55) {
      evening.add(const RoutineStep(
        id: 'soothing',
        nameAr: 'مرطب مهدئ',
        nameEn: 'Soothing Moisturizer',
        stepAr: 'مساءً — طبقة كاملة',
        period: 'pm',
      ));
    } else {
      evening.add(RoutineStep(
        id: 'moisturizer_pm',
        nameAr: moisture < 60 ? 'كريم ترطيب غني' : 'مرطب يومي',
        nameEn: moisture < 60 ? 'Rich Moisturizer' : 'Daily Moisturizer',
        stepAr: 'مساءً — قبل النوم',
        period: 'pm',
      ));
    }

    return DailyRoutinePlan(morning: morning, evening: evening);
  }

  static ConcernZonesSection _concernZones(SkinReport report) {
    final scores = {for (final c in SkinReportMatrix.matrixScores(report)) c.id: c.score};
    int ui(String id, int fallback) => scores[id] ?? fallback;

    final oilinessUi = ui('oiliness', 100 - report.oiliness);
    final moisture = ui('moisture', report.hydration);
    final pores = ui('pore', 100 - report.pores * 20);
    final redness = ui('redness', 100 - report.redness * 20);

    const disclaimer =
        'تقدير عام من ميرا — ليس تشخيصاً موضعياً على الوجه ولا خريطة طبية.';
    final zones = <ConcernZoneNarrative>[];

    if (oilinessUi < 60) {
      zones.add(const ConcernZoneNarrative(
        id: 't_zone',
        zoneLabelAr: 'منطقة T-Zone (الجبهة والأنف)',
        narrativeAr:
            'قد تظهر زيادة الدهون بشكل أوضح في الجبهة وخط الأنف — تقدير عام وليس marker على الوجه.',
        concernIds: ['oiliness'],
      ));
    }
    if (moisture < 58) {
      zones.add(const ConcernZoneNarrative(
        id: 'cheeks',
        zoneLabelAr: 'منطقة الخدين',
        narrativeAr:
            'الجفاف قد يكون أكثر وضوحاً في منطقة الخدين — تقدير عام من scores عامة.',
        concernIds: ['moisture'],
      ));
    }
    if (pores < 58) {
      zones.add(const ConcernZoneNarrative(
        id: 'nose_area',
        zoneLabelAr: 'منطقة الأنف والذقن',
        narrativeAr:
            'المسام قد تبدو أوضح في الأنف والذقن — ليس تشخيصاً موضعياً دقيقاً.',
        concernIds: ['pore'],
      ));
    }
    if (redness < 55) {
      zones.add(const ConcernZoneNarrative(
        id: 'cheeks_redness',
        zoneLabelAr: 'منطقة الوسط والخدين',
        narrativeAr:
            'الاحمرار قد يظهر بشكل أوضح في منتصف الوجه — ركزي على منتجات مهدئة.',
        concernIds: ['redness'],
      ));
    }

    return ConcernZonesSection(
      enabled: zones.isNotEmpty,
      mode: 'narrative_only',
      spatialConfidence: 'none',
      titleAr: 'مناطق الاهتمام (تقدير عام)',
      disclaimerAr: disclaimer,
      zones: zones.take(4).toList(),
    );
  }
}
