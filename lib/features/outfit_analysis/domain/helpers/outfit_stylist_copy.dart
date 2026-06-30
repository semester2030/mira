import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../entities/outfit_analysis.dart';
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

  static List<OutfitColorInsight> colorHarmonyInsights(
    OutfitAnalysis analysis, {
    SkinReport? skin,
  }) {
    final insights = <OutfitColorInsight>[];
    final undertone = skin != null
        ? UndertoneResolver.labelAr(SkinPaletteMapper.fromSkinReport(skin).undertone)
        : null;

    for (final color in analysis.dominantColors.take(3)) {
      insights.add(
        OutfitColorInsight(
          colorNameAr: color,
          category: OutfitColorCategory.current,
          whyAr: _whyCurrentColor(color, analysis, undertone),
        ),
      );
    }

    for (final color in analysis.recommendedColors.take(4)) {
      if (analysis.dominantColors.contains(color)) continue;
      insights.add(
        OutfitColorInsight(
          colorNameAr: color,
          category: OutfitColorCategory.compatible,
          whyAr: _whyCompatibleColor(color, undertone),
        ),
      );
    }

    for (final color in analysis.rejectedColors.take(3)) {
      insights.add(
        OutfitColorInsight(
          colorNameAr: color,
          category: OutfitColorCategory.avoid,
          whyAr: _whyAvoidColor(color, undertone),
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

    for (final reason in analysis.matchReasons) {
      lines.add(_humanize(reason));
    }

    if (analysis.colorHarmonyScore >= 78) {
      lines.add('انسجام الألوان يمنح إطلالتك حضوراً أنيقاً ومتوازناً');
    }

    if (analysis.occasionMatchScore >= 80) {
      lines.add(
        'القصة والألوان تخدم مناسبة ${analysis.occasion.labelAr} بثقة',
      );
    }

    if (undertone != null && analysis.isSmartMode) {
      final matching = analysis.dominantColors.where(
        (c) => analysis.recommendedColors.any((r) => _sameFamily(c, r)),
      );
      if (matching.isNotEmpty) {
        lines.add(
          'لون ${matching.first} يرفع دفء undertone $undertone ويُبرز إشراق وجهك',
        );
      } else if (analysis.recommendedColors.isNotEmpty) {
        lines.add(
          'جرّبي ${analysis.recommendedColors.first} — ينسجم مع undertone $undertone',
        );
      }
    }

    if (analysis.styleBalanceScore >= 76) {
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

  static String _whyCurrentColor(
    String color,
    OutfitAnalysis analysis,
    String? undertone,
  ) {
    if (analysis.recommendedColors.any((r) => _sameFamily(r, color))) {
      return undertone != null
          ? '$color ينسجم مع undertone $undertone ويُبرز إشراقك'
          : '$color ينسجم مع ألوان إطلالتك الحالية';
    }
    if (analysis.rejectedColors.any((r) => _sameFamily(r, color))) {
      return 'استخدمي $color بحذر — قد يقلل من توهج البشرة';
    }
    return '$color يعطي إطلالتك شخصية مميزة';
  }

  static String _whyCompatibleColor(String color, String? undertone) {
    if (undertone != null) {
      return '$color يرفع دفء undertone $undertone ويمنح إشراقة أعلى';
    }
    return '$color بديل أنيق ينسجم مع إطلالتك';
  }

  static String _whyAvoidColor(String color, String? undertone) {
    if (undertone != null) {
      return 'تجنّبي $color — قد يخفف توازن undertone $undertone';
    }
    return '$color قد يشتت التنسيق — جرّبي بديلاً أنعم';
  }

  static String _humanize(String raw) {
    if (raw.contains('undertone')) {
      return raw.replaceAll('undertone', 'Undertone');
    }
    return raw;
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
  final OutfitColorCategory category;
  final String whyAr;

  const OutfitColorInsight({
    required this.colorNameAr,
    required this.category,
    required this.whyAr,
  });
}
