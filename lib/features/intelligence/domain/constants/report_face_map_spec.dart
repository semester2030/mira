import 'package:flutter/material.dart';

/// Independently controllable face-map regions.
enum FaceMapRegion {
  forehead,
  foreheadCenter,
  underEyesLeft,
  underEyesRight,
  nose,
  cheeksLeft,
  cheeksRight,
  chin,
  mouthPerioral,
  jawline,
  smileLinesLeft,
  smileLinesRight,
  crowFeetLeft,
  crowFeetRight,
}

enum FaceMapIntensity { high, medium, low }

/// One highlighted region with intensity tier.
class FaceMapRegionHighlight {
  final FaceMapRegion region;
  final FaceMapIntensity intensity;

  const FaceMapRegionHighlight(this.region, this.intensity);

  @override
  bool operator ==(Object other) =>
      other is FaceMapRegionHighlight &&
      other.region == region &&
      other.intensity == intensity;

  @override
  int get hashCode => Object.hash(region, intensity);
}

/// Smart guided face-map — concern overlays tied to analysis score.
abstract final class ReportFaceMapSpec {
  static const switchDurationMs = 300;
  static const borderOpacity = 0.32;
  static const blurSigma = 3.5;

  static const titleAr = 'خريطة مؤشرات البشرة';
  static const subtitleAr =
      'تعرض المناطق الشائعة المرتبطة بالمؤشر المختار بناءً على نتيجة تحليلك.';
  static const confidenceBadgeAr = 'إرشادية — مرتبطة بنتيجتك';
  static const disclaimerAr =
      'خريطة إرشادية ذكية — المناطق الملوّنة مرتبطة بنتيجة المؤشر المختار، وليست تشخيصاً موضعياً.';

  static const mapBackground = Color(0xFFFFFFFF);

  /// Legend tier multipliers applied on top of [scoreOpacity].
  static const highTierFactor = 1.0;
  static const mediumTierFactor = 0.88;
  static const lowTierFactor = 0.75;

  static const _specs = <String, _ConcernSpec>{
    'oiliness': _ConcernSpec(
      color: Color(0xFFD4AF37),
      heroCopyAr:
          'المناطق الملونة تتغير حسب درجتك — كلما زادت النتيجة زادت كثافة الظهور.',
      factors: _oilinessFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.nose, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.chin, FaceMapIntensity.high),
      ],
    ),
    'pore': _ConcernSpec(
      color: Color(0xFFA855F7),
      heroCopyAr:
          'المناطق المظللة تشير إلى أكثر المناطق ارتباطاً بوضوح المسام.',
      factors: _poreFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.nose, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.foreheadCenter, FaceMapIntensity.medium),
      ],
    ),
    'moisture': _ConcernSpec(
      color: Color(0xFF3B82F6),
      heroCopyAr:
          'المناطق الظاهرة تمثل أكثر الأماكن احتياجاً لدعم الترطيب حسب مؤشرك.',
      factors: _moistureFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.mouthPerioral, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.medium),
      ],
    ),
    'dark_circle': _ConcernSpec(
      color: Color(0xFF6D28D9),
      heroCopyAr:
          'المناطق تحت العينين مرتبطة مباشرة بدرجة مؤشر الهالات في تحليلك.',
      factors: _darkCircleFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.underEyesLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.underEyesRight, FaceMapIntensity.high),
      ],
    ),
    'redness': _ConcernSpec(
      color: Color(0xFFEF4444),
      heroCopyAr:
          'الخدين والأنف يظهران بكثافة تتناسب مع درجة الاحمرار في نتيجتك.',
      factors: _rednessFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.nose, FaceMapIntensity.high),
      ],
    ),
    'acne': _ConcernSpec(
      color: Color(0xFFF97316),
      heroCopyAr:
          'المناطق الملونة تعكس شدة مؤشر الحبوب — كلما ارتفعت النتيجة زادت الوضوح.',
      factors: _acneFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.chin, FaceMapIntensity.high),
      ],
    ),
    'wrinkle': _ConcernSpec(
      color: Color(0xFFC084FC),
      heroCopyAr:
          'الجبهة وحول العين وخطوط الابتسامة تتغيّر حسب درجة مؤشر التجاعيد.',
      factors: _wrinkleFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.underEyesLeft, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.underEyesRight, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.crowFeetLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.crowFeetRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.smileLinesLeft, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.smileLinesRight, FaceMapIntensity.medium),
      ],
    ),
    'age_spot': _ConcernSpec(
      color: Color(0xFFD4A574),
      heroCopyAr:
          'الخدين والجبهة تظهران بكثافة مرتبطة بدرجة مؤشر التصبغات.',
      factors: _pigmentationFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.high),
      ],
    ),
    'texture': _ConcernSpec(
      color: Color(0xFF10B981),
      heroCopyAr:
          'المناطق الملوّنة تعكس شدة مؤشر الملمس في نتيجة تحليلك.',
      factors: _textureFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.chin, FaceMapIntensity.medium),
      ],
    ),
  };

  static const _aliases = <String, String>{
    'pores': 'pore',
    'hydration': 'moisture',
    'dark_circles': 'dark_circle',
    'pigmentation': 'age_spot',
    'wrinkles': 'wrinkle',
  };

  static const _pigmentationFactors = [
    FaceMapFactor(Icons.grid_view_rounded, 'التصبغات'),
    FaceMapFactor(Icons.wb_sunny_outlined, 'أشعة الشمس'),
    FaceMapFactor(Icons.biotech_outlined, 'العوامل الوراثية'),
    FaceMapFactor(Icons.science_outlined, 'التغيرات الهرمونية'),
  ];
  static const _darkCircleFactors = [
    FaceMapFactor(Icons.bedtime_outlined, 'قلة النوم'),
    FaceMapFactor(Icons.water_drop_outlined, 'الجفاف'),
    FaceMapFactor(Icons.schedule, 'الإرهاق'),
    FaceMapFactor(Icons.face_retouching_natural, 'العناية بالعين'),
  ];
  static const _acneFactors = [
    FaceMapFactor(Icons.opacity, 'الدهون الزائدة'),
    FaceMapFactor(Icons.spa_outlined, 'المنتجات'),
    FaceMapFactor(Icons.restaurant, 'النظام الغذائي'),
    FaceMapFactor(Icons.air, 'التهوية'),
  ];
  static const _textureFactors = [
    FaceMapFactor(Icons.grain, 'الملمس'),
    FaceMapFactor(Icons.water_drop_outlined, 'الترطيب'),
    FaceMapFactor(Icons.spa, 'التقشير اللطيف'),
    FaceMapFactor(Icons.shield_outlined, 'الحماية'),
  ];
  static const _wrinkleFactors = [
    FaceMapFactor(Icons.timeline, 'التجاعيد'),
    FaceMapFactor(Icons.wb_sunny_outlined, 'الشمس'),
    FaceMapFactor(Icons.water_drop, 'الترطيب'),
    FaceMapFactor(Icons.self_improvement, 'نمط الحياة'),
  ];
  static const _poreFactors = [
    FaceMapFactor(Icons.blur_on, 'المسام'),
    FaceMapFactor(Icons.opacity, 'الدهون'),
    FaceMapFactor(Icons.cleaning_services_outlined, 'التنظيف'),
    FaceMapFactor(Icons.spa_outlined, 'العناية'),
  ];
  static const _moistureFactors = [
    FaceMapFactor(Icons.water_drop, 'الترطيب'),
    FaceMapFactor(Icons.air, 'الرطوبة'),
    FaceMapFactor(Icons.spa, 'العناية'),
    FaceMapFactor(Icons.shield, 'الحماية'),
  ];
  static const _rednessFactors = [
    FaceMapFactor(Icons.local_fire_department_outlined, 'الاحمرار'),
    FaceMapFactor(Icons.wb_sunny_outlined, 'الشمس'),
    FaceMapFactor(Icons.spa, 'التهدئة'),
    FaceMapFactor(Icons.shield_outlined, 'الحماية'),
  ];
  static const _oilinessFactors = [
    FaceMapFactor(Icons.opacity, 'الدهون'),
    FaceMapFactor(Icons.water_drop_outlined, 'التوازن'),
    FaceMapFactor(Icons.spa_outlined, 'التنظيف'),
    FaceMapFactor(Icons.eco_outlined, 'العناية'),
  ];

  static List<String> get tabOrder => [
        'oiliness',
        'pore',
        'moisture',
        'dark_circle',
        'redness',
        'acne',
        'wrinkle',
        'age_spot',
        'texture',
      ];

  static String canonicalId(String concernId) =>
      _aliases[concernId] ?? concernId;

  static Color colorFor(String concernId, {String? fallbackHex}) {
    final spec = _specs[canonicalId(concernId)];
    if (spec != null) return spec.color;
    if (fallbackHex != null) return _parseHex(fallbackHex);
    return const Color(0xFFD4AF37);
  }

  static List<FaceMapRegionHighlight> highlightsFor(
    String concernId,
    List<String> legacyZoneIds,
  ) {
    final spec = _specs[canonicalId(concernId)];
    if (spec != null) return spec.highlights;
    return _legacyHighlights(legacyZoneIds);
  }

  static List<FaceMapFactor> factorsFor(String concernId) =>
      _specs[canonicalId(concernId)]?.factors ?? _pigmentationFactors;

  static String heroCopyFor(String concernId) =>
      _specs[canonicalId(concernId)]?.heroCopyAr ??
      'المناطق الملونة مرتبطة بنتيجة المؤشر المختار — كلما زادت النتيجة زادت الكثافة.';

  static String regionId(FaceMapRegion region) => switch (region) {
        FaceMapRegion.forehead => 'forehead',
        FaceMapRegion.foreheadCenter => 'forehead_center',
        FaceMapRegion.underEyesLeft => 'under_eyes_left',
        FaceMapRegion.underEyesRight => 'under_eyes_right',
        FaceMapRegion.nose => 'nose',
        FaceMapRegion.cheeksLeft => 'cheeks_left',
        FaceMapRegion.cheeksRight => 'cheeks_right',
        FaceMapRegion.chin => 'chin',
        FaceMapRegion.mouthPerioral => 'mouth_perioral',
        FaceMapRegion.jawline => 'jawline',
        FaceMapRegion.smileLinesLeft => 'smile_lines_left',
        FaceMapRegion.smileLinesRight => 'smile_lines_right',
        FaceMapRegion.crowFeetLeft => 'crow_feet_left',
        FaceMapRegion.crowFeetRight => 'crow_feet_right',
      };

  /// Direct score → opacity bands (0–100 on chip).
  static double scoreOpacity(int score) {
    final s = score.clamp(0, 100);
    if (s <= 40) return 0.15;
    if (s <= 60) return 0.30;
    if (s <= 80) return 0.50;
    return 0.70;
  }

  static double fillOpacityFor(FaceMapIntensity intensity, int score) {
    final tier = switch (intensity) {
      FaceMapIntensity.high => highTierFactor,
      FaceMapIntensity.medium => mediumTierFactor,
      FaceMapIntensity.low => lowTierFactor,
    };
    return (scoreOpacity(score) * tier).clamp(0.12, 0.75);
  }

  /// Legend preview opacities at a reference score of 70.
  static double legendHighOpacity = scoreOpacity(70) * highTierFactor;
  static double legendMediumOpacity = scoreOpacity(70) * mediumTierFactor;
  static double legendLowOpacity = scoreOpacity(70) * lowTierFactor;

  static List<FaceMapRegionHighlight> _legacyHighlights(List<String> ids) {
    final regions = <FaceMapRegion>{};
    for (final id in ids) {
      if (id.contains('forehead') || id == 't_zone') {
        regions.add(FaceMapRegion.forehead);
      }
      if (id.contains('under_eye')) {
        regions.add(FaceMapRegion.underEyesLeft);
        regions.add(FaceMapRegion.underEyesRight);
      }
      if (id == 'nose' || id.contains('t_zone')) regions.add(FaceMapRegion.nose);
      if (id.contains('cheek')) {
        regions.add(FaceMapRegion.cheeksLeft);
        regions.add(FaceMapRegion.cheeksRight);
      }
      if (id.contains('chin') || id.contains('jaw')) {
        regions.add(FaceMapRegion.chin);
      }
      if (id.contains('mouth')) regions.add(FaceMapRegion.mouthPerioral);
    }
    if (regions.isEmpty) {
      return [const FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.high)];
    }
    return [
      for (final r in regions)
        FaceMapRegionHighlight(r, FaceMapIntensity.high),
    ];
  }

  static Color _parseHex(String hex) {
    final value = hex.replaceFirst('#', '');
    return Color(int.parse('FF$value', radix: 16));
  }
}

class FaceMapFactor {
  final IconData icon;
  final String labelAr;
  const FaceMapFactor(this.icon, this.labelAr);
}

class _ConcernSpec {
  final Color color;
  final String heroCopyAr;
  final List<FaceMapRegionHighlight> highlights;
  final List<FaceMapFactor> factors;

  const _ConcernSpec({
    required this.color,
    required this.heroCopyAr,
    required this.highlights,
    required this.factors,
  });
}
