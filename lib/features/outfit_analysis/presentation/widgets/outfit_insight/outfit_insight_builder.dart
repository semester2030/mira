import 'package:flutter/material.dart';

import '../../../domain/entities/outfit_analysis.dart';
import '../../../domain/entities/suggested_piece_model.dart';
import '../../../domain/services/fashion_recommendation_engine.dart';
import '../../utils/fashion_color_binding.dart';
import 'outfit_insight_item.dart';

/// Builds luxury insight tiles from deterministic stylist engine.
abstract final class OutfitInsightBuilder {
  OutfitInsightBuilder._();

  static List<OutfitPaletteSwatch> palette(OutfitAnalysis analysis) {
    final detailed =
        analysis.segmentMap?.garmentPalette.detailedColors ?? const [];
    final out = <OutfitPaletteSwatch>[];
    final seen = <String>{};

    // Detected colors only — never mix recommended/suggested into "current".
    for (final d in detailed) {
      final key = d.hex.isNotEmpty ? d.hex : d.nameAr;
      if (key.isEmpty || !seen.add(key)) continue;
      final color = FashionColorBinding.resolve(
        hex: d.hex,
        nameAr: d.nameAr,
        source: FashionColorSource.detected,
      );
      if (color == null) continue;
      out.add(OutfitPaletteSwatch(nameAr: d.displayNameAr, color: color));
      if (out.length >= 5) break;
    }

    if (out.isNotEmpty) return out;

    final names = <String>[
      ...analysis.upperBodyColors,
      ...analysis.dominantColors,
      ...analysis.lowerBodyColors,
      ...analysis.shoeColors,
    ];
    for (final name in names) {
      final t = name.trim();
      if (t.isEmpty || seen.contains(t)) continue;
      seen.add(t);
      final color = FashionColorBinding.resolve(
        nameAr: t,
        source: FashionColorSource.detected,
      );
      if (color == null) continue;
      out.add(OutfitPaletteSwatch(nameAr: t, color: color));
      if (out.length >= 5) break;
    }
    return out;
  }

  static List<SuggestedPieceModel> clothingPieces(OutfitAnalysis analysis) {
    // Keep catalog rows even when asset load fails — UI shows honest placeholder.
    // Filtering missing assets is not a substitute for fixing image sources.
    return FashionRecommendationEngine.suggestClothing(analysis);
  }

  static List<SuggestedPieceModel> accessories(OutfitAnalysis analysis) {
    return FashionRecommendationEngine.suggestAccessories(analysis);
  }

  static List<OutfitInsightItem> makeup(OutfitAnalysis analysis) {
    if (!analysis.isSmartMode && analysis.suggestedMakeup.isEmpty) {
      return const [];
    }

    final swatches = palette(analysis);
    final c1 =
        swatches.isNotEmpty ? swatches[0].color : const Color(0xFFE8A0B0);
    final c2 =
        swatches.length > 1 ? swatches[1].color : const Color(0xFFC96BB2);
    final c3 =
        swatches.length > 2 ? swatches[2].color : const Color(0xFF8B5E6B);

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
}
