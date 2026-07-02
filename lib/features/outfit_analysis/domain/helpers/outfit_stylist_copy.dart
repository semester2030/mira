import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../entities/detected_garment_color.dart';
import '../entities/outfit_analysis.dart';
import '../helpers/outfit_arabic_labels.dart';
import '../helpers/undertone_resolver.dart';
import '../helpers/skin_palette_mapper.dart';

/// Premium stylist copy — beauty-first, personalized Arabic.
abstract final class OutfitStylistCopy {
  OutfitStylistCopy._();

  static OutfitHeroCopy hero(OutfitAnalysis analysis) {
    final title = _outfitTitle(analysis);
    final occasionLine = _occasionLine(analysis);
    final elegance = _eleganceLevel(analysis);
    final visualTag = _visualHarmonyTag(analysis);

    return OutfitHeroCopy(
      outfitTitle: title,
      occasionMatchLine: occasionLine,
      eleganceLevel: elegance,
      visualHarmonyTag: visualTag,
    );
  }

  /// Always derived from [compatibilityScore] — never stale cached text.
  static String scoreSubtitle(OutfitAnalysis analysis) {
    final score = analysis.compatibilityScore;
    final garment = analysis.clothingType.isNotEmpty ? analysis.clothingType : 'إطلالتك';
    final style = analysis.styleType.isNotEmpty ? analysis.styleType : 'متوازنة';
    final occasion = analysis.occasion.labelAr;

    if (analysis.isSmartMode) {
      return 'تقييم $score/100 لـ$garment ($style) في مناسبة $occasion — مرتبط بتحليل بشرتك.';
    }
    return 'تحليل $score/100 لـ$garment ($style) في مناسبة $occasion — '
        'فعّلي تحليل البشرة لدقة أعلى.';
  }

  static List<OutfitColorInsight> colorHarmonyInsights(
    OutfitAnalysis analysis, {
    SkinReport? skin,
  }) {
    final insights = <OutfitColorInsight>[];
    final undertone = skin != null
        ? UndertoneResolver.labelAr(SkinPaletteMapper.fromSkinReport(skin).undertone)
        : null;

    final currentDetails = analysis.segmentMap?.garmentPalette.detailedColors ?? const [];
    if (currentDetails.isNotEmpty) {
      for (var i = 0; i < currentDetails.length && i < 3; i++) {
        final d = currentDetails[i];
        insights.add(
          OutfitColorInsight(
            colorNameAr: d.nameAr,
            displayNameAr: d.displayNameAr,
            hex: d.hex,
            confidence: d.confidence,
            matchTierAr: d.matchTierAr,
            category: OutfitColorCategory.current,
            whyAr: _whyDetectedColor(d, analysis, undertone, index: i),
          ),
        );
      }
    } else {
      final current = _detectedGarmentColors(analysis).take(3).toList();
      for (var i = 0; i < current.length; i++) {
        insights.add(
          OutfitColorInsight(
            colorNameAr: current[i],
            category: OutfitColorCategory.current,
            whyAr: _whyCurrentColor(current[i], analysis, undertone, index: i),
          ),
        );
      }
    }

    var compatibleIndex = 0;
    for (final color in analysis.recommendedColors.take(4)) {
      if (analysis.dominantColors.contains(color)) continue;
      insights.add(
        OutfitColorInsight(
          colorNameAr: color,
          category: OutfitColorCategory.compatible,
          whyAr: _whyCompatibleColor(color, undertone, index: compatibleIndex++),
        ),
      );
    }

    for (final color in analysis.rejectedColors.take(3)) {
      insights.add(
        OutfitColorInsight(
          colorNameAr: color,
          category: OutfitColorCategory.avoid,
          whyAr: _whyAvoidColor(color, undertone, analysis),
        ),
      );
    }

    return insights;
  }

  static List<String> whyThisWorks(
    OutfitAnalysis analysis, {
    SkinReport? skin,
  }) {
    final lines = <String>[];
    final undertone = skin != null
        ? UndertoneResolver.labelAr(SkinPaletteMapper.fromSkinReport(skin).undertone)
        : null;
    final occasion = analysis.occasion.labelAr;

    for (final reason in analysis.matchReasons) {
      lines.add(OutfitArabicLabels.humanizeEngineCopy(reason));
    }

    if (analysis.colorHarmonyScore >= 78 &&
        !lines.any((l) => l.contains('انسجام') || l.contains('لون'))) {
      lines.add('انسجام الألوان يمنح إطلالتك حضوراً أنيقاً ومتوازناً');
    }

    if (analysis.occasionMatchScore >= 80 &&
        !lines.any((l) => l.contains(occasion))) {
      lines.add('القصة والألوان تخدم مناسبة $occasion بثقة');
    }

    if (undertone != null && analysis.isSmartMode) {
      final matching = analysis.dominantColors.where(
        (c) => analysis.recommendedColors.any((r) => _sameFamily(c, r)),
      );
      if (matching.isNotEmpty) {
        lines.add(
          'لون ${matching.first} يرفع دفء ${OutfitArabicLabels.undertonePhrase(undertone)} '
          'ويُبرز إشراق وجهك',
        );
      } else if (analysis.recommendedColors.isNotEmpty) {
        lines.add(
          'جرّبي ${analysis.recommendedColors.first} — ينسجم مع '
          '${OutfitArabicLabels.undertonePhrase(undertone)}',
        );
      }
    }

    if (analysis.styleBalanceScore >= 76 &&
        !lines.any((l) => l.contains('توازن') || l.contains('بصري'))) {
      lines.add('التوازن البصري في القطع يعطي انطباعاً راقياً دون مبالغة');
    }

    if (lines.isEmpty) {
      lines.add('إطلالتك تحمل شخصية واضحة — مع لمسات بسيطة تصبحين أكثر تألقاً');
    }

    final seen = <String>{};
    return lines.where((l) {
      final key = l.trim();
      if (seen.contains(key)) return false;
      seen.add(key);
      return true;
    }).take(5).toList();
  }

  static String _outfitTitle(OutfitAnalysis analysis) {
    final style = analysis.styleType.isNotEmpty ? analysis.styleType : 'متوازنة';
    final piece = analysis.clothingType.isNotEmpty ? analysis.clothingType : 'إطلالة';
    if (analysis.compatibilityScore >= 85) {
      return 'إطلالة $style — $piece';
    }
    if (analysis.compatibilityScore >= 70) {
      return 'إطلالة $style متناسقة';
    }
    return 'إطلالة $style';
  }

  static String _occasionLine(OutfitAnalysis analysis) {
    final score = analysis.occasionMatchScore;
    if (score >= 85) {
      return 'مناسبة تماماً لـ ${analysis.occasion.labelAr}';
    }
    if (score >= 70) {
      return 'ملائمة لـ ${analysis.occasion.labelAr}';
    }
    return 'تحتاج ضبطاً لـ ${analysis.occasion.labelAr}';
  }

  static String _eleganceLevel(OutfitAnalysis analysis) {
    final formality = _formalityValue(analysis.formalityLevel);
    if (formality >= 0.72) return 'مستوى أناقة: راقية';
    if (formality >= 0.52) return 'مستوى أناقة: متوازنة';
    return 'مستوى أناقة: ناعمة وكاجوال';
  }

  static String _visualHarmonyTag(OutfitAnalysis analysis) {
    if (analysis.colorHarmonyScore >= 85) return 'انسجام بصري قوي';
    if (analysis.colorHarmonyScore >= 72) return 'انسجام بصري جيد';
    if (analysis.styleBalanceScore >= 75) return 'توازن بصري لطيف';
    return 'فرصة لتعزيز التناسق اللوني';
  }

  static List<String> _detectedGarmentColors(OutfitAnalysis analysis) {
    final seen = <String>{};
    final out = <String>[];
    void addAll(Iterable<String> colors) {
      for (final raw in colors) {
        final t = raw.trim();
        if (t.isEmpty || seen.contains(t)) continue;
        seen.add(t);
        out.add(t);
      }
    }

    addAll(analysis.upperBodyColors);
    if (analysis.segmentMap?.garmentPalette.isReliable == true) {
      addAll(analysis.segmentMap!.garmentPalette.ordered);
    }
    addAll(analysis.dominantColors);
    addAll(analysis.lowerBodyColors);
    return out;
  }

  static String _whyDetectedColor(
    DetectedGarmentColor color,
    OutfitAnalysis analysis,
    String? undertone, {
    int index = 0,
  }) {
    final garment = analysis.clothingType.isNotEmpty ? analysis.clothingType : 'إطلالتك';
    final occasion = analysis.occasion.labelAr;
    final undertoneSuffix =
        undertone != null ? ' — ينسجم مع ${OutfitArabicLabels.undertonePhrase(undertone)}' : '';
    final pct = (color.confidence * 100).round();

    return switch (index) {
      0 => 'رصدنا ${color.displayNameAr} في $garment — ${color.matchTierAr} ($pct%)$undertoneSuffix',
      1 => '${color.displayNameAr} يظهر كطبقة لونية ثانية في إطلالتك — $pct% ثقة',
      _ => '${color.displayNameAr} يكمل لوحة $occasion — درجة ${color.shadeAr}',
    };
  }

  static String _whyCurrentColor(
    String color,
    OutfitAnalysis analysis,
    String? undertone, {
    int index = 0,
  }) {
    final garment = analysis.clothingType.isNotEmpty ? analysis.clothingType : 'إطلالتك';
    final occasion = analysis.occasion.labelAr;
    final undertoneSuffix =
        undertone != null ? ' — ينسجم مع ${OutfitArabicLabels.undertonePhrase(undertone)}' : '';

    if (analysis.recommendedColors.any((r) => _sameFamily(r, color)) &&
        !analysis.dominantColors.contains(color) &&
        !analysis.upperBodyColors.contains(color)) {
      return switch (index) {
        0 => 'لون $color هو الأساس في $garment — يخدم $occasion$undertoneSuffix',
        1 => '$color يضيف عمقاً ويرفع توازن الإطلالة$undertoneSuffix',
        _ => '$color يكمل لوحة $occasion بانسجام$undertoneSuffix',
      };
    }
    if (analysis.rejectedColors.any((r) => _sameFamily(r, color))) {
      return 'استخدمي $color بحذر — قد يقلل من توهج البشرة في $occasion';
    }
    return switch (index) {
      0 => 'رصدنا $color كأحد ألوان $garment في الصورة$undertoneSuffix',
      1 => '$color يظهر بوضوح في إطلالتك الحالية',
      _ => '$color يساهم في شخصية الإطلالة في $occasion',
    };
  }

  static String _whyCompatibleColor(String color, String? undertone, {int index = 0}) {
    if (undertone != null) {
      return switch (index) {
        0 => '$color يرفع دفء ${OutfitArabicLabels.undertonePhrase(undertone)} ويمنح إشراقة أعلى',
        _ => '$color بديل أنيق ينسجم مع ${OutfitArabicLabels.undertonePhrase(undertone)}',
      };
    }
    return switch (index) {
      0 => '$color يضيف لمسة أنيقة دون مبالغة',
      1 => '$color بديل متوازن يرفع انسجام الإطلالة',
      _ => '$color ينسجم مع باقي ألوان إطلالتك',
    };
  }

  static String _whyAvoidColor(String color, String? undertone, OutfitAnalysis analysis) {
    if (color.contains('مزج') || color.contains('كثيرة')) {
      return 'تقليل عدد الألوان يرفع انسجام ${analysis.occasion.labelAr} — '
          'اختاري لونين أساسيين';
    }
    if (undertone != null) {
      return 'تجنّبي $color — قد يخفف توازن ${OutfitArabicLabels.undertonePhrase(undertone)}';
    }
    return '$color قد يشتت التنسيق — جرّبي بديلاً أنعم';
  }

  static bool _sameFamily(String a, String b) {
    final na = a.trim();
    final nb = b.trim();
    if (na == nb) return true;
    return na.contains(nb) || nb.contains(na);
  }

  static double _formalityValue(String raw) {
    final n = double.tryParse(raw.trim());
    if (n != null) return n.clamp(0, 1);
    if (raw.contains('رسمي') && !raw.contains('شبه')) return 0.78;
    if (raw.contains('شبه')) return 0.58;
    if (raw.contains('كاج')) return 0.35;
    return 0.5;
  }
}

class OutfitHeroCopy {
  final String outfitTitle;
  final String occasionMatchLine;
  final String eleganceLevel;
  final String visualHarmonyTag;

  const OutfitHeroCopy({
    required this.outfitTitle,
    required this.occasionMatchLine,
    required this.eleganceLevel,
    required this.visualHarmonyTag,
  });
}

enum OutfitColorCategory { current, compatible, avoid }

class OutfitColorInsight {
  final String colorNameAr;
  final String? displayNameAr;
  final String? hex;
  final double? confidence;
  final String? matchTierAr;
  final OutfitColorCategory category;
  final String whyAr;

  const OutfitColorInsight({
    required this.colorNameAr,
    this.displayNameAr,
    this.hex,
    this.confidence,
    this.matchTierAr,
    required this.category,
    required this.whyAr,
  });

  String get titleAr => displayNameAr ?? colorNameAr;
}
