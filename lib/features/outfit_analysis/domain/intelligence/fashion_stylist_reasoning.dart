import '../catalog/fashion_asset_catalog.dart';
import '../entities/outfit_analysis.dart';
import '../helpers/outfit_arabic_labels.dart';

/// Phase 14 — explainable stylist copy in Arabic.
abstract final class FashionStylistReasoning {
  FashionStylistReasoning._();

  static String build({
    required CatalogPiece piece,
    required OutfitAnalysis analysis,
    required Map<String, double> breakdown,
    required List<String> evidence,
    String? graphWhy,
  }) {
    if (graphWhy != null && graphWhy.isNotEmpty) {
      return OutfitArabicLabels.humanizeEngineCopy(graphWhy);
    }

    final parts = <String>[];
    final archetype = piece.archetypes.isNotEmpty ? piece.archetypes.first : piece.styleTag;

    parts.add('اخترنا ${piece.titleAr}');

    if ((breakdown['colorHarmony'] ?? 0) >= 12) {
      parts.add('لأنه يوازن ألوان إطلالتك');
    } else if ((breakdown['compatibility'] ?? 0) >= 15) {
      parts.add('لأنه يكمل القطع المكتشفة في إطلالتك');
    }

    if (archetype == 'quiet_luxury' || archetype == 'old_money') {
      parts.add('ويعزّز طابع الرفاهية الهادئة');
    } else if (archetype == 'business') {
      parts.add('ويرفع حضورك المهني');
    } else if (archetype == 'evening' || archetype == 'wedding') {
      parts.add('ويناسب أناقة المناسبة');
    }

    if ((breakdown['trend'] ?? 0) >= 8) {
      parts.add('مع لمسة ${OutfitArabicLabels.trend2026()}');
    }

    if ((breakdown['season'] ?? 0) >= 10) {
      parts.add('في موسمك الحالي');
    }

    if (parts.length == 1 && piece.whyAr.isNotEmpty) {
      return OutfitArabicLabels.humanizeEngineCopy(piece.whyAr);
    }

    return '${parts.join(' ')}.';
  }

  static List<String> buildEvidence({
    required CatalogPiece piece,
    required Map<String, double> breakdown,
  }) {
    final out = <String>[];
    if ((breakdown['colorHarmony'] ?? 0) >= 10) {
      out.add(OutfitArabicLabels.colorHarmonyEvidence(breakdown['colorHarmony']!.round()));
    }
    if ((breakdown['graph'] ?? 0) >= 10) {
      out.add(OutfitArabicLabels.knowledgeGraphMatch());
    }
    if ((breakdown['trend'] ?? 0) >= 6) {
      out.add(OutfitArabicLabels.trend2026());
    }
    if (piece.scores.luxury >= 90) {
      out.add(OutfitArabicLabels.luxuryScoreLine(piece.scores.luxury));
    }
    if (out.isEmpty && piece.whyAr.isNotEmpty) {
      out.add(OutfitArabicLabels.humanizeEngineCopy(piece.whyAr));
    }
    return out;
  }

  static double confidenceFromBreakdown(Map<String, double> breakdown) {
    if (breakdown.isEmpty) return 0.65;
    final avg = breakdown.values.reduce((a, b) => a + b) / breakdown.length;
    return (0.55 + avg / 100 * 0.4).clamp(0.5, 0.98);
  }
}
