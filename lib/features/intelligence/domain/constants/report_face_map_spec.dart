import 'package:flutter/material.dart';

/// Independently controllable face-map regions.
enum FaceMapRegion {
  forehead,
  foreheadCenter,
  foreheadWide,
  foreheadCornerLeft,
  foreheadCornerRight,
  underEyesLeft,
  underEyesRight,
  nose,
  noseBridge,
  noseBridgeCenter,
  noseTip,
  noseSideLeft,
  noseSideRight,
  noseWingLeft,
  noseWingRight,
  cheeksLeft,
  cheeksRight,
  upperCheekLeft,
  upperCheekRight,
  cheekWideLeft,
  cheekWideRight,
  chin,
  chinCenter,
  mouthPerioral,
  jawline,
  smileLinesLeft,
  smileLinesRight,
  crowFeetLeft,
  crowFeetRight,
  pigmentCheekboneLeft,
  pigmentCheekboneRight,
}

enum FaceMapIntensity { high, medium, low }

enum FaceMapRenderMode { heatmap, wrinkleLines, acneSpots, textureGrain }

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
      'تعرض هذه الخريطة المناطق الأكثر ارتباطاً بنتيجة تحليلك، وقد تختلف عن التوزيع الفعلي على البشرة.';

  static const mapBackground = Color(0xFFFFFFFF);

  static const highTierFactor = 1.0;
  static const mediumTierFactor = 0.88;
  static const lowTierFactor = 0.75;

  static const _specs = <String, _ConcernSpec>{
    'oiliness': _ConcernSpec(
      color: Color(0xFFD4AF37),
      renderMode: FaceMapRenderMode.heatmap,
      heroCopyAr:
          'مركز الجبهة وجسر الأنف وطرفه والذقن — كثافة الظهور تتناسب مع درجة الدهنية.',
      factors: _oilinessFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.foreheadCenter, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.noseBridge, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.noseTip, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.chinCenter, FaceMapIntensity.high),
      ],
    ),
    'pore': _ConcernSpec(
      color: Color(0xFFA855F7),
      renderMode: FaceMapRenderMode.heatmap,
      heroCopyAr:
          'جوانب الأنف والخدين العلويين ومركز الجسر — أكثر المناطق ارتباطاً بمؤشر المسام.',
      factors: _poreFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.noseSideLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.noseSideRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.upperCheekLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.upperCheekRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.noseBridgeCenter, FaceMapIntensity.medium),
      ],
    ),
    'moisture': _ConcernSpec(
      color: Color(0xFF3B82F6),
      renderMode: FaceMapRenderMode.heatmap,
      heroCopyAr:
          'الخدين والجبهة وحول الفم — تمثل أكثر الأماكن ارتباطاً بمؤشر الترطيب.',
      factors: _moistureFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheekWideLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheekWideRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.foreheadWide, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.mouthPerioral, FaceMapIntensity.high),
      ],
    ),
    'dark_circle': _ConcernSpec(
      color: Color(0xFF6D28D9),
      renderMode: FaceMapRenderMode.heatmap,
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
      renderMode: FaceMapRenderMode.heatmap,
      heroCopyAr:
          'الخدين وأجنحة الأنف تظهر بكثافة تتناسب مع درجة الاحمرار في نتيجتك.',
      factors: _rednessFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheekWideLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheekWideRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.noseWingLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.noseWingRight, FaceMapIntensity.high),
      ],
    ),
    'acne': _ConcernSpec(
      color: Color(0xFFF97316),
      renderMode: FaceMapRenderMode.acneSpots,
      heroCopyAr:
          'بقع موضّعة على الجبهة والذقن والخدين — عددها ووضوحها يتناسبان مع درجة المؤشر.',
      factors: _acneFactors,
      highlights: [],
    ),
    'wrinkle': _ConcernSpec(
      color: Color(0xFFC084FC),
      renderMode: FaceMapRenderMode.wrinkleLines,
      heroCopyAr:
          'خطوط الجبهة وحول العين وطيات الابتسامة — تتغيّر حسب درجة مؤشر التجاعيد.',
      factors: _wrinkleFactors,
      highlights: [],
    ),
    'age_spot': _ConcernSpec(
      color: Color(0xFFD4A574),
      renderMode: FaceMapRenderMode.heatmap,
      heroCopyAr:
          'بقع متفرقة على زوايا الجبهة وعظام الخد — مرتبطة بدرجة مؤشر التصبغات.',
      factors: _pigmentationFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.foreheadCornerLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.foreheadCornerRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.pigmentCheekboneLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.pigmentCheekboneRight, FaceMapIntensity.high),
      ],
    ),
    'texture': _ConcernSpec(
      color: Color(0xFF10B981),
      renderMode: FaceMapRenderMode.textureGrain,
      heroCopyAr:
          'حبيبات دقيقة موزّعة على الوجه — تعكس شدة مؤشر الملمس في نتيجة تحليلك.',
      factors: _textureFactors,
      highlights: [],
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

  static FaceMapRenderMode renderModeFor(String concernId) =>
      _specs[canonicalId(concernId)]?.renderMode ?? FaceMapRenderMode.heatmap;

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
        FaceMapRegion.forehead => 'forehead_wide',
        FaceMapRegion.foreheadCenter => 'forehead_center',
        FaceMapRegion.foreheadWide => 'forehead_wide',
        FaceMapRegion.foreheadCornerLeft => 'forehead_corner_l',
        FaceMapRegion.foreheadCornerRight => 'forehead_corner_r',
        FaceMapRegion.underEyesLeft => 'under_eyes_l',
        FaceMapRegion.underEyesRight => 'under_eyes_r',
        FaceMapRegion.nose => 'nose_bridge',
        FaceMapRegion.noseBridge => 'nose_bridge',
        FaceMapRegion.noseBridgeCenter => 'nose_bridge_center',
        FaceMapRegion.noseTip => 'nose_tip',
        FaceMapRegion.noseSideLeft => 'nose_side_l',
        FaceMapRegion.noseSideRight => 'nose_side_r',
        FaceMapRegion.noseWingLeft => 'nose_wing_l',
        FaceMapRegion.noseWingRight => 'nose_wing_r',
        FaceMapRegion.cheeksLeft => 'cheek_wide_l',
        FaceMapRegion.cheeksRight => 'cheek_wide_r',
        FaceMapRegion.upperCheekLeft => 'upper_cheek_l',
        FaceMapRegion.upperCheekRight => 'upper_cheek_r',
        FaceMapRegion.cheekWideLeft => 'cheek_wide_l',
        FaceMapRegion.cheekWideRight => 'cheek_wide_r',
        FaceMapRegion.chin => 'chin_center',
        FaceMapRegion.chinCenter => 'chin_center',
        FaceMapRegion.mouthPerioral => 'mouth_perioral',
        FaceMapRegion.jawline => 'chin_center',
        FaceMapRegion.smileLinesLeft => 'mouth_perioral',
        FaceMapRegion.smileLinesRight => 'mouth_perioral',
        FaceMapRegion.crowFeetLeft => 'under_eyes_l',
        FaceMapRegion.crowFeetRight => 'under_eyes_r',
        FaceMapRegion.pigmentCheekboneLeft => 'pigment_cheekbone_l',
        FaceMapRegion.pigmentCheekboneRight => 'pigment_cheekbone_r',
      };

  /// Direct score → opacity bands (0–100 on chip).
  static double scoreOpacity(int score) {
    final s = score.clamp(0, 100);
    if (s <= 30) return 0.15;
    if (s <= 50) return 0.25;
    if (s <= 70) return 0.40;
    if (s <= 85) return 0.55;
    return 0.72;
  }

  /// Higher score → larger heatmap spread.
  static double scoreSpread(int score) {
    final s = score.clamp(0, 100);
    if (s <= 30) return 0.88;
    if (s <= 50) return 0.96;
    if (s <= 70) return 1.04;
    if (s <= 85) return 1.10;
    return 1.16;
  }

  /// Higher score → slightly darker saturation.
  static Color saturatedColor(Color base, int score) {
    final factor = 0.88 + (score.clamp(0, 100) / 100) * 0.22;
    return Color.fromARGB(
      (base.a * 255).round().clamp(0, 255),
      (base.r * 255 * factor).round().clamp(0, 255),
      (base.g * 255 * factor).round().clamp(0, 255),
      (base.b * 255 * factor).round().clamp(0, 255),
    );
  }

  static double fillOpacityFor(FaceMapIntensity intensity, int score) {
    final tier = switch (intensity) {
      FaceMapIntensity.high => highTierFactor,
      FaceMapIntensity.medium => mediumTierFactor,
      FaceMapIntensity.low => lowTierFactor,
    };
    return (scoreOpacity(score) * tier).clamp(0.12, 0.78);
  }

  static double legendHighOpacity = scoreOpacity(70) * highTierFactor;
  static double legendMediumOpacity = scoreOpacity(70) * mediumTierFactor;
  static double legendLowOpacity = scoreOpacity(70) * lowTierFactor;

  static List<FaceMapRegionHighlight> _legacyHighlights(List<String> ids) {
    final regions = <FaceMapRegion>{};
    for (final id in ids) {
      if (id.contains('forehead') || id == 't_zone') {
        regions.add(FaceMapRegion.foreheadCenter);
      }
      if (id.contains('under_eye')) {
        regions.add(FaceMapRegion.underEyesLeft);
        regions.add(FaceMapRegion.underEyesRight);
      }
      if (id == 'nose' || id.contains('t_zone')) {
        regions.add(FaceMapRegion.noseBridge);
      }
      if (id.contains('cheek')) {
        regions.add(FaceMapRegion.cheekWideLeft);
        regions.add(FaceMapRegion.cheekWideRight);
      }
      if (id.contains('chin') || id.contains('jaw')) {
        regions.add(FaceMapRegion.chinCenter);
      }
      if (id.contains('mouth')) regions.add(FaceMapRegion.mouthPerioral);
    }
    if (regions.isEmpty) {
      return [
        const FaceMapRegionHighlight(
          FaceMapRegion.foreheadCenter,
          FaceMapIntensity.high,
        ),
      ];
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
  final FaceMapRenderMode renderMode;
  final List<FaceMapRegionHighlight> highlights;
  final List<FaceMapFactor> factors;

  const _ConcernSpec({
    required this.color,
    required this.heroCopyAr,
    required this.renderMode,
    required this.highlights,
    required this.factors,
  });
}
