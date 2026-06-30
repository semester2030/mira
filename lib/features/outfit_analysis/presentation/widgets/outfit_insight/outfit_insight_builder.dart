import 'package:flutter/material.dart';

import '../../../domain/entities/outfit_analysis.dart';
import '../../../domain/entities/suggested_piece_model.dart';
import '../../../domain/services/fashion_recommendation_engine.dart';
import 'outfit_insight_item.dart';

/// Builds luxury insight tiles from deterministic stylist engine.
abstract final class OutfitInsightBuilder {
  OutfitInsightBuilder._();

  static List<OutfitPaletteSwatch> palette(OutfitAnalysis analysis) {
    final names = <String>[
      ...analysis.recommendedColors,
      ...analysis.dominantColors,
      ...analysis.upperBodyColors,
      ...analysis.lowerBodyColors,
      ...analysis.shoeColors,
    ];
    final seen = <String>{};
    final out = <OutfitPaletteSwatch>[];
    for (final name in names) {
      final t = name.trim();
      if (t.isEmpty || seen.contains(t)) continue;
      seen.add(t);
      out.add(
        OutfitPaletteSwatch(
          nameAr: t,
          color: _colorFromName(t),
        ),
      );
      if (out.length >= 5) break;
    }
    return out;
  }

  static List<SuggestedPieceModel> clothingPieces(OutfitAnalysis analysis) {
    return FashionRecommendationEngine.suggestClothing(analysis);
  }

  static List<SuggestedPieceModel> accessories(OutfitAnalysis analysis) {
    return FashionRecommendationEngine.suggestAccessories(analysis);
  }

  static List<OutfitInsightItem> makeup(OutfitAnalysis analysis) {
    if (!analysis.isSmartMode && analysis.suggestedMakeup.isEmpty) return const [];

    final swatches = palette(analysis);
    final c1 = swatches.isNotEmpty ? swatches[0].color : const Color(0xFFE8A0B0);
    final c2 = swatches.length > 1 ? swatches[1].color : const Color(0xFFC96BB2);
    final c3 = swatches.length > 2 ? swatches[2].color : const Color(0xFF8B5E6B);

    return [
      OutfitInsightItem(
        labelAr: 'بلشر ناعم',
        kind: OutfitVisualKind.makeupCompact,
        primary: c1,
        accent: c2,
        subtitleAr: analysis.suggestedMakeup.isNotEmpty
            ? analysis.suggestedMakeup
            : 'لمسة وردية تناسب تدرج بشرتك',
      ),
      OutfitInsightItem(
        labelAr: 'أحمر شفاه',
        kind: OutfitVisualKind.lipstick,
        primary: c2,
        accent: c1,
      ),
      OutfitInsightItem(
        labelAr: 'ظلال عيون',
        kind: OutfitVisualKind.eyeshadow,
        primary: c3,
        accent: c2,
      ),
    ];
  }

  static Color _colorFromName(String name) {
    return switch (name) {
      'أسود' => const Color(0xFF1A1A1A),
      'أبيض' => const Color(0xFFF5F5F5),
      'بيج' => const Color(0xFFD4C4A8),
      'كريمي' => const Color(0xFFF0E6D8),
      'ذهبي' => const Color(0xFFC9A962),
      'فضي' => const Color(0xFFB8B8C0),
      'كحلي' => const Color(0xFF1E2A4A),
      'أزرق' => const Color(0xFF3A5A9A),
      'وردي' => const Color(0xFFE8A0B0),
      'نبيتي' => const Color(0xFF6B2038),
      'بني' => const Color(0xFF7A5A3A),
      'زيتوني' => const Color(0xFF6B7050),
      _ => const Color(0xFFD4C4A8),
    };
  }
}
