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
}

/// Educational concern → region overlays + luxury palette.
abstract final class ReportFaceMapSpec {
  static const highOpacity = 0.22;
  static const mediumOpacity = 0.16;
  static const lowOpacity = 0.10;
  static const borderOpacity = 0.20;
  static const blurSigma = 6.0;
  static const switchDurationMs = 300;

  static const disclaimerAr =
      'الخريطة توضّح المناطق الشائعة ارتباطاً بهذا المؤشر، وليست تشخيصاً موضعياً دقيقاً.';

  static const mapBackground = Color(0xFFFFFFFF);

  static const _specs = <String, _ConcernSpec>{
    'pore': _ConcernSpec(
      color: Color(0xFFA855F7),
      factors: _poreFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.nose, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.foreheadCenter, FaceMapIntensity.low),
      ],
    ),
    'oiliness': _ConcernSpec(
      color: Color(0xFFF59E0B),
      factors: _oilinessFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.nose, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.chin, FaceMapIntensity.medium),
      ],
    ),
    'moisture': _ConcernSpec(
      color: Color(0xFF3B82F6),
      factors: _moistureFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.chin, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.underEyesLeft, FaceMapIntensity.low),
        FaceMapRegionHighlight(FaceMapRegion.underEyesRight, FaceMapIntensity.low),
      ],
    ),
    'redness': _ConcernSpec(
      color: Color(0xFFEF4444),
      factors: _rednessFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.nose, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.chin, FaceMapIntensity.low),
      ],
    ),
    'age_spot': _ConcernSpec(
      color: Color(0xFFD97706),
      factors: _pigmentationFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.underEyesLeft, FaceMapIntensity.low),
        FaceMapRegionHighlight(FaceMapRegion.underEyesRight, FaceMapIntensity.low),
        FaceMapRegionHighlight(FaceMapRegion.smileLinesLeft, FaceMapIntensity.low),
        FaceMapRegionHighlight(FaceMapRegion.smileLinesRight, FaceMapIntensity.low),
      ],
    ),
    'wrinkle': _ConcernSpec(
      color: Color(0xFFEC4899),
      factors: _wrinkleFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.crowFeetLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.crowFeetRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.smileLinesLeft, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.smileLinesRight, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.underEyesLeft, FaceMapIntensity.low),
        FaceMapRegionHighlight(FaceMapRegion.underEyesRight, FaceMapIntensity.low),
      ],
    ),
    'acne': _ConcernSpec(
      color: Color(0xFFF97316),
      factors: _acneFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.chin, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.jawline, FaceMapIntensity.medium),
      ],
    ),
    'dark_circle': _ConcernSpec(
      color: Color(0xFF7C3AED),
      factors: _darkCircleFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.underEyesLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.underEyesRight, FaceMapIntensity.high),
      ],
    ),
    'texture': _ConcernSpec(
      color: Color(0xFF10B981),
      factors: _textureFactors,
      highlights: [
        FaceMapRegionHighlight(FaceMapRegion.cheeksLeft, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.cheeksRight, FaceMapIntensity.high),
        FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.medium),
        FaceMapRegionHighlight(FaceMapRegion.chin, FaceMapIntensity.medium),
      ],
    ),
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
        'pore',
        'moisture',
        'oiliness',
        'redness',
        'age_spot',
        'wrinkle',
        'acne',
        'dark_circle',
        'texture',
      ];

  static Color colorFor(String concernId, {String? fallbackHex}) {
    final spec = _specs[concernId];
    if (spec != null) return spec.color;
    if (fallbackHex != null) return _parseHex(fallbackHex);
    return const Color(0xFFD97706);
  }

  static List<FaceMapRegionHighlight> highlightsFor(
    String concernId,
    List<String> legacyZoneIds,
  ) {
    final spec = _specs[concernId];
    if (spec != null) return spec.highlights;
    return _legacyHighlights(legacyZoneIds);
  }

  static List<FaceMapFactor> factorsFor(String concernId) =>
      _specs[concernId]?.factors ?? _pigmentationFactors;

  static String regionId(FaceMapRegion region) => switch (region) {
        FaceMapRegion.forehead => 'forehead',
        FaceMapRegion.foreheadCenter => 'forehead_center',
        FaceMapRegion.underEyesLeft => 'under_eyes_left',
        FaceMapRegion.underEyesRight => 'under_eyes_right',
        FaceMapRegion.nose => 'nose',
        FaceMapRegion.cheeksLeft => 'cheeks_left',
        FaceMapRegion.cheeksRight => 'cheeks_right',
        FaceMapRegion.chin => 'chin',
        FaceMapRegion.jawline => 'jawline',
        FaceMapRegion.smileLinesLeft => 'smile_lines_left',
        FaceMapRegion.smileLinesRight => 'smile_lines_right',
        FaceMapRegion.crowFeetLeft => 'crow_feet_left',
        FaceMapRegion.crowFeetRight => 'crow_feet_right',
      };

  static double baseOpacity(FaceMapIntensity intensity) => switch (intensity) {
        FaceMapIntensity.high => highOpacity,
        FaceMapIntensity.medium => mediumOpacity,
        FaceMapIntensity.low => lowOpacity,
      };

  /// Score >= 85 stronger · 70–84 normal · < 70 subtle.
  static double scoreMultiplier(int score) {
    if (score >= 85) return 1.12;
    if (score >= 70) return 1.0;
    return 0.78;
  }

  static double fillOpacityFor(FaceMapIntensity intensity, int score) =>
      (baseOpacity(intensity) * scoreMultiplier(score)).clamp(0.08, 0.28);

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
      if (id.contains('smile')) {
        regions.add(FaceMapRegion.smileLinesLeft);
        regions.add(FaceMapRegion.smileLinesRight);
      }
      if (id.contains('crows')) {
        regions.add(FaceMapRegion.crowFeetLeft);
        regions.add(FaceMapRegion.crowFeetRight);
      }
    }
    if (regions.isEmpty) {
      return [const FaceMapRegionHighlight(FaceMapRegion.forehead, FaceMapIntensity.medium)];
    }
    return [
      for (final r in regions)
        FaceMapRegionHighlight(r, FaceMapIntensity.medium),
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
  final List<FaceMapRegionHighlight> highlights;
  final List<FaceMapFactor> factors;

  const _ConcernSpec({
    required this.color,
    required this.highlights,
    required this.factors,
  });
}
