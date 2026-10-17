import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../skin_analysis/domain/services/skin_report_matrix.dart';
import '../../../skin_analysis/domain/services/beauty_score_engine.dart';
import '../entities/beauty_journey.dart';
import '../entities/confidence_layer.dart';
import '../entities/mira_beauty_report.dart';
import '../entities/concern_zones_section.dart';
import '../services/local_face_map_builder.dart';
import '../entities/progress_forecast.dart';
import 'local_age_intelligence.dart';
import 'local_beauty_journey_builder.dart';
import 'local_confidence_layer_builder.dart';
import '../entities/weekly_plan.dart';
import 'local_weekly_plan_builder.dart';

/// Offline fallback — mirrors backend engines for guest / legacy reports.
abstract final class LocalMiraReportBuilder {
  LocalMiraReportBuilder._();

  static MiraBeautyReport fromSkinReport(
    SkinReport report, {
    int? birthYear,
    bool isGuest = false,
  }) {
    final scored = BeautyScoreEngine.compute(report);
    final score = scored.finalScore;
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
    // ignore: deprecated_member_use — Phase 4F deprecation; see local-face-map-builder-deprecation.md
    final faceHealthMap = LocalFaceMapBuilder.fromSkinReport(report);
    final dailyRoutine = _routine(report);
    final weeklyPlan = LocalWeeklyPlanBuilder.fromSkinReport(report, dailyRoutine);

    final base = MiraBeautyReport(
      version: 1,
      spatialConfidence: 'none',
      overallBeautyScore: score,
      overallScoreAvailable: scored.overallScoreAvailable,
      headlineAr: scored.overallScoreAvailable
          ? _headline(score)
          : overallComparisonUnavailableAr,
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
      tipsAr: _personalizedTips(concerns),
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
      overallScoreAvailable: base.overallScoreAvailable,
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
      overallScoreAvailable: withJourney.overallScoreAvailable,
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
    if (score >= 79) {
      return 'بشرتك في حالة ممتازة — نكمل معاً على روتين يحافظ على توازنها.';
    }
    if (score >= 69) {
      return 'بشرتك في حالة جيدة — روتين ميرا يساعدك على تحسين ${score >= 74 ? 'التوازن' : 'النقاط الضعيفة'}.';
    }
    if (score >= 56) {
      return 'بشرتك تحتاج عناية مركّزة — خطة ميرا اليومية تناسبك.';
    }
    return 'بشرتك تستحق اهتماماً إضافياً — ابدئي بالخطوات البسيطة أدناه.';
  }

  static List<ConcernNarrative> _concerns(SkinReport report) {
    final scores = SkinReportMatrix.matrixScores(report);
    final byId = {for (final c in scores) c.id: c.score};

    int ui(String id, int fallback) => byId[id] ?? fallback;

    final moisture = byId['moisture'] ?? report.hydration;
    final items = <ConcernNarrative>[
      if (moisture != null) _n('moisture', 'الترطيب', moisture),
      _n('oiliness', 'إفراز الدهون', ui('oiliness', report.oiliness)),
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
        'noticeable': 'المسام بارزة — التنظيف اللطيف مفيد، واختيار المقشر يكون مع مختص عند الحاجة.',
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
        'moderate': 'حبوب متوسطة — التنظيف اللطيف مفيد، وتقييم العلاج يكون مع مختص وليس من الصورة.',
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
    final int? moisture = scores['moisture'] ?? report.hydration;
    final oilinessUi = scores['oiliness'] ?? report.oiliness;
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

    if (moisture != null && moisture < 62) {
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
        nameAr: 'عناية لطيفة بالحبوب',
        nameEn: 'Gentle blemish care',
        stepAr: 'لا تلمسيها. تقييم أي علاج يكون مع مختص، وليس من صورة التحليل.',
        period: 'pm',
      ));
    } else if (pores < 58) {
      evening.add(const RoutineStep(
        id: 'treatment_pores',
        nameAr: 'تنظيف لطيف للمسام',
        nameEn: 'Gentle pore care',
        stepAr: 'تجنبي الإفراط في المقشرات. اختيار المقشر يكون مع مختص عند الحاجة.',
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
        nameAr: moisture != null && moisture < 60 ? 'كريم ترطيب غني' : 'مرطب يومي',
        nameEn: moisture != null && moisture < 60 ? 'Rich Moisturizer' : 'Daily Moisturizer',
        stepAr: 'مساءً — قبل النوم',
        period: 'pm',
      ));
    }

    return DailyRoutinePlan(morning: morning, evening: evening);
  }

  static ConcernZonesSection _concernZones(SkinReport report) {
    final scores = {for (final c in SkinReportMatrix.matrixScores(report)) c.id: c.score};
    int ui(String id, int fallback) => scores[id] ?? fallback;

    final oilinessUi = ui('oiliness', report.oiliness);
    final int? moisture = scores['moisture'] ?? report.hydration;
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
    if (moisture != null && moisture < 58) {
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

  static List<String> currentTipsFor(SkinReport report) {
    return _personalizedTips(_concerns(report));
  }

  static List<String> _personalizedTips(List<ConcernNarrative> concerns) {
    final actionable = concerns.where((c) => c.severity != 'none').toList();
    if (actionable.isEmpty) {
      return const [
        'بشرتك في توازن جيد — حافظي على روتينك الحالي وواقي الشمس يومياً.',
      ];
    }

    return [
      'روتين يومي: تنظيف لطيف، ترطيب، وواقي شمس.',
      for (final c in actionable.take(4)) _tipForConcern(c.id),
    ].take(5).toList();
  }

  static String _tipForConcern(String id) => switch (id) {
        'moisture' =>
          'لأن مؤشر الترطيب لديك يحتاج دعماً بسيطاً، ابدئي بروتين خفيف: تنظيف لطيف صباحاً، مرطب يومي، وواقي شمس.',
        'pore' =>
          'لأن المسام بارزة لديك، ركزي على تنظيف لطيف دون الإفراط في المقشرات، واختيار المقشر يكون مع مختص عند الحاجة.',
        'oiliness' =>
          'لأن إفراز الدهون مرتفع، اختاري منظفاً يوازن الدهون دون تجفيف البشرة.',
        'redness' =>
          'لأن الاحمرار ظاهر، تجنبي الحرارة والمنتجات القاسية واختاري مرطبات مهدئة.',
        'age_spot' =>
          'لأن التصبغات واضحة، واقي SPF 50 يومياً هو أهم خطوة قبل أي منتج تفتيح.',
        'wrinkle' =>
          'لأن علامات التجاعيد ظاهرة، اجمعي بين ترطيب يومي وواقي شمس — النتائج تحتاج وقتاً.',
        'acne' =>
          'لأن الحبوب ظاهرة، تجنبي لمس الوجه. تقييم أي علاج يكون مع مختص، وليس من صورة التحليل.',
        'dark_circle' =>
          'لأن الهالات بارزة، نوم كافٍ وترطيب خفيف تحت العين يساعدان على المظهر.',
        _ =>
          'ركزي على روتين بسيط وثابت — النتائج تحتاج صبراً وانتظاماً.',
      };

  static final _legacyDose = RegExp(
    r'BHA|BPO|ريتينويد|retinoid|benzoyl|ساليسيليك',
    caseSensitive: false,
  );

  static String _keepOrGeneral(String text) {
    if (_legacyDose.hasMatch(text)) {
      return 'اتبعي روتينًا لطيفًا وثابتًا. تقييم أي علاج يكون مع مختص، وليس من صورة التحليل.';
    }
    return text;
  }

  static Map<String, int> _knownScores(MiraBeautyReport report) {
    final scores = <String, int>{};
    void put(String id, num value) {
      final key = id == 'hydration' ? 'moisture' : id;
      scores.putIfAbsent(key, () => value.round());
    }

    for (final overlay in report.faceHealthMap.concernOverlays) {
      final score = overlay.globalScore;
      if (score != null) put(overlay.concernId, score);
    }
    for (final metric in report.skinIntelligence?.metrics ?? const []) {
      if (metric.isAvailable && metric.normalizedValue != null) {
        put(metric.id, metric.normalizedValue!);
      }
    }
    return scores;
  }

  static DailyRoutinePlan _routineFromKnown(Map<String, int> scores) {
    final moisture = scores['moisture'];
    final oilinessUi = scores['oiliness'];
    final oilinessHigh = oilinessUi != null && oilinessUi < 55;
    final acne = scores['acne'];
    final redness = scores['redness'];
    final pores = scores['pore'];
    final morning = <RoutineStep>[
      RoutineStep(
        id: 'cleanser_am',
        nameAr: oilinessHigh ? 'غسول توازن الدهون' : 'غسول لطيف',
        nameEn: oilinessHigh ? 'Balancing Cleanser' : 'Gentle Cleanser',
        stepAr: 'صباحاً — 30 ثانية بلطف',
        period: 'am',
      ),
    ];
    if (moisture != null && moisture < 62) {
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
    if (acne != null && acne < 58) {
      evening.add(const RoutineStep(
        id: 'treatment_acne',
        nameAr: 'عناية لطيفة بالحبوب',
        nameEn: 'Gentle blemish care',
        stepAr: 'لا تلمسيها. تقييم أي علاج يكون مع مختص، وليس من صورة التحليل.',
        period: 'pm',
      ));
    } else if (pores != null && pores < 58) {
      evening.add(const RoutineStep(
        id: 'treatment_pores',
        nameAr: 'تنظيف لطيف للمسام',
        nameEn: 'Gentle pore care',
        stepAr: 'تجنبي الإفراط في المقشرات. اختيار المقشر يكون مع مختص عند الحاجة.',
        period: 'pm',
      ));
    }
    evening.add(RoutineStep(
      id: redness != null && redness < 55 ? 'soothing' : 'moisturizer_pm',
      nameAr: redness != null && redness < 55
          ? 'مرطب مهدئ'
          : (moisture != null && moisture < 60 ? 'كريم ترطيب غني' : 'مرطب يومي'),
      nameEn: 'Moisturizer',
      stepAr: 'مساءً — قبل النوم',
      period: 'pm',
    ));
    return DailyRoutinePlan(morning: morning, evening: evening);
  }

  static RoutineStep _soften(RoutineStep step) {
    final blob = '${step.nameAr} ${step.nameEn} ${step.stepAr}';
    if (!_legacyDose.hasMatch(blob)) return step;
    return RoutineStep(
      id: step.id,
      nameAr: 'عناية لطيفة',
      nameEn: 'Gentle care',
      stepAr: 'تنظيف لطيف وترطيب. اختيار المقشر أو العلاج يكون مع مختص، وليس من صورة التحليل.',
      period: step.period,
    );
  }

  static WeeklyPlan _sanitizeWeekly(WeeklyPlan plan, DailyRoutinePlan routine) {
    final days = plan.days
        .map(
          (day) => WeeklyPlanDay(
            dayIndex: day.dayIndex,
            labelAr: day.labelAr,
            focusAr: _keepOrGeneral(day.focusAr),
            stepsAr: day.stepsAr
                .map((step) => _legacyDose.hasMatch(step)
                    ? 'تنظيف لطيف وترطيب. اختيار المقشر أو العلاج يكون مع مختص، وليس من صورة التحليل.'
                    : step)
                .toList(),
          ),
        )
        .toList();
    if (days.isEmpty) return LocalWeeklyPlanBuilder.fromKnownScores(const {}, routine);
    return WeeklyPlan(
      enabled: plan.enabled,
      headlineAr: _keepOrGeneral(plan.headlineAr),
      summaryAr: _keepOrGeneral(plan.summaryAr),
      days: days,
    );
  }

  static DailyRoutinePlan _sanitizeRoutine(DailyRoutinePlan routine) {
    final morning = routine.morning.map(_soften).toList();
    final evening = routine.evening.map(_soften).toList();
    if (morning.isEmpty && evening.isEmpty) return _routineFromKnown(const {});
    final base = _routineFromKnown(const {});
    return DailyRoutinePlan(
      morning: morning.isEmpty ? base.morning : morning,
      evening: evening.isEmpty ? base.evening : evening,
    );
  }

  /// Display copy of a stored report. The stored object is not modified.
  static MiraBeautyReport presentStored(MiraBeautyReport report) {
    final concerns = report.mainConcerns
        .map(
          (concern) => ConcernNarrative(
            id: concern.id,
            titleAr: concern.titleAr,
            narrativeAr: _narrative(concern.id, concern.severity),
            severity: concern.severity,
          ),
        )
        .toList();
    final scores = _knownScores(report);
    final routine = scores.isEmpty ? _sanitizeRoutine(report.dailyRoutine) : _routineFromKnown(scores);
    final progress = report.progressForecast.forStoredDisplay(
      reportOverallAvailable: report.overallScoreAvailable,
    );
    return MiraBeautyReport(
      version: report.version,
      scoreSchemaVersion: report.scoreSchemaVersion,
      spatialConfidence: report.spatialConfidence,
      overallBeautyScore: report.overallBeautyScore,
      overallScoreAvailable: report.overallScoreAvailable,
      displayScoreLabelAr: report.displayScoreLabelAr,
      displayScoreLabelEn: report.displayScoreLabelEn,
      scoreSupportingAr: report.scoreSupportingAr,
      disclaimerAr: report.disclaimerAr,
      disclaimerEn: report.disclaimerEn,
      provenance: report.provenance,
      headlineAr: _keepOrGeneral(report.headlineAr),
      skinTypeAr: report.skinTypeAr,
      skinTypeEn: report.skinTypeEn,
      skinAgeEstimate: report.skinAgeEstimate,
      ageComparison: report.ageComparison,
      childSafety: report.childSafety,
      mainConcerns: concerns,
      dailyRoutine: routine,
      summaryAdviceAr: _keepOrGeneral(report.summaryAdviceAr),
      tipsAr: _personalizedTips(concerns),
      faceMapEnabled: report.faceMapEnabled,
      concernZonesSection: report.concernZonesSection,
      faceHealthMap: report.faceHealthMap,
      concernZonesNarrative: report.concernZonesNarrative,
      recommendedProducts: report.recommendedProducts,
      weeklyPlan: scores.isEmpty
          ? _sanitizeWeekly(report.weeklyPlan, routine)
          : LocalWeeklyPlanBuilder.fromKnownScores(scores, routine),
      progressForecast: progress,
      beautyJourney: report.overallScoreAvailable == true
          ? report.beautyJourney
          : BeautyJourney(
              enabled: report.beautyJourney.enabled,
              headlineAr: report.beautyJourney.headlineAr,
              summaryAr: report.beautyJourney.summaryAr,
              currentOverallScore: report.beautyJourney.currentOverallScore,
              nextGoal: JourneyGoal(
                metricId: 'overall',
                labelAr: 'مؤشر جمال البشرة',
                currentValue: report.beautyJourney.currentOverallScore,
                targetValue: report.beautyJourney.currentOverallScore,
                horizonDays: 30,
                headlineAr: overallComparisonUnavailableAr,
                summaryAr: overallComparisonUnavailableAr,
                scoreAvailable: false,
              ),
              topOpportunity: report.beautyJourney.topOpportunity,
              priorities: report.beautyJourney.priorities,
              planSummaryAr: report.beautyJourney.planSummaryAr,
              followUpAr: report.beautyJourney.followUpAr,
            ),
      confidenceLayer: report.confidenceLayer,
      skinIntelligence: report.skinIntelligence,
      faceIntelligence: report.faceIntelligence,
      faceIntelligenceRuntime: report.faceIntelligenceRuntime,
    );
  }
}
