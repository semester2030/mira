import '../../../outfit_analysis/domain/entities/outfit_analysis.dart';
import '../../../outfit_analysis/domain/entities/outfit_segment_map.dart';
import '../entities/advisor_fashion_context.dart';

/// AT-3 — Narrow public-safe projection from OutfitAnalysis → Advisor fashion DTO.
/// Does not invent silhouette/material/culture. UNKNOWN accessories stay UNKNOWN.
abstract final class AdvisorFashionContextMapper {
  static AdvisorFashionContext fromOutfitAnalysis(
    OutfitAnalysis analysis, {
    String? outfitAnalysisId,
    bool? evidenceStaleOverride,
    List<String> extraPreferenceTokens = const [],
    String? explicitCulturalContext,
    bool culturalContextExplicit = false,
    String? styleGoalOverride,
    String? dressCodeOverride,
  }) {
    final garments = _garmentsFrom(analysis);
    final accessories = _accessoriesFrom(analysis);
    final evidenceRefs = <String>[
      for (final g in garments) 'ev_${g.garmentId}',
      for (final a in accessories.where((x) => x.presence == 'PRESENT'))
        'ev_${a.accessoryId}',
      'ev_occasion_${analysis.occasion.id}',
    ];

    final dressCode = dressCodeOverride ?? _dressCodeHint(analysis);
    final styleGoal = styleGoalOverride;
    final stale = evidenceStaleOverride ?? _isStale(analysis);

    return AdvisorFashionContext(
      garments: garments,
      accessories: accessories,
      outfitId: outfitAnalysisId ??
          'outfit:${analysis.occasion.id}:${analysis.clothingType.hashCode.abs()}',
      occasion: analysis.occasion.id,
      dressCode: dressCode,
      styleGoal: styleGoal,
      preferenceTokens: List<String>.unmodifiable(extraPreferenceTokens),
      culturalContext: explicitCulturalContext,
      culturalContextExplicit:
          explicitCulturalContext != null ? culturalContextExplicit : null,
      evidenceRefs: evidenceRefs,
      evidenceStale: stale,
    );
  }

  static List<AdvisorFashionGarmentFact> _garmentsFrom(OutfitAnalysis a) {
    final upper = a.upperBodyColors.isNotEmpty
        ? a.upperBodyColors
        : (a.dominantColors.isNotEmpty
            ? [a.dominantColors.first]
            : const <String>[]);
    final lower = a.lowerBodyColors.isNotEmpty
        ? a.lowerBodyColors
        : (a.dominantColors.length > 1
            ? [a.dominantColors[1]]
            : const <String>[]);

    final out = <AdvisorFashionGarmentFact>[];
    if (upper.isNotEmpty || a.clothingType.isNotEmpty) {
      out.add(
        AdvisorFashionGarmentFact(
          garmentId: 'garment:upper',
          category: 'top',
          type: _upperTypeHint(a.clothingType),
          colors: upper,
          // silhouette/material omitted unless truly known — not fabricated
        ),
      );
    }
    if (lower.isNotEmpty) {
      out.add(
        AdvisorFashionGarmentFact(
          garmentId: 'garment:lower',
          category: 'bottom',
          type: _lowerTypeHint(a.clothingType, a.detectedPieces),
          colors: lower,
        ),
      );
    }
    // Fallback single garment when region colors missing
    if (out.isEmpty && a.dominantColors.isNotEmpty) {
      out.add(
        AdvisorFashionGarmentFact(
          garmentId: 'garment:look',
          category: 'outfit',
          type: a.clothingType.isNotEmpty ? a.clothingType : null,
          colors: a.dominantColors,
        ),
      );
    }
    return out;
  }

  static List<AdvisorFashionAccessoryFact> _accessoriesFrom(OutfitAnalysis a) {
    final shoesPresent = a.shoeColors.isNotEmpty ||
        _regionHasColors(a.segmentMap, OutfitSegmentZone.feet);
    final bagsOrAccPresent = a.accessoryColors.isNotEmpty ||
        _regionHasColors(a.segmentMap, OutfitSegmentZone.accessories);

    return [
      AdvisorFashionAccessoryFact(
        accessoryId: 'accessory:shoes',
        category: 'shoes',
        presence: shoesPresent ? 'PRESENT' : 'UNKNOWN',
        colors: a.shoeColors,
      ),
      AdvisorFashionAccessoryFact(
        accessoryId: 'accessory:bags',
        category: 'bags',
        // Colors alone do not prove a bag — UNKNOWN unless accessory zone colors
        presence: bagsOrAccPresent ? 'PRESENT' : 'UNKNOWN',
        colors: a.accessoryColors,
      ),
      const AdvisorFashionAccessoryFact(
        accessoryId: 'accessory:jewelry',
        category: 'jewelry',
        presence: 'UNKNOWN',
      ),
    ];
  }

  static bool _regionHasColors(
    OutfitSegmentMap? map,
    OutfitSegmentZone zone,
  ) {
    if (map == null) return false;
    for (final r in map.regions) {
      if (r.zone == zone && r.colors.isNotEmpty) return true;
    }
    return false;
  }

  /// Only map formality when it is an explicit discrete label — not a float invent.
  static String? _dressCodeHint(OutfitAnalysis a) {
    final f = a.formalityLevel.trim().toLowerCase();
    if (f.isEmpty) return null;
    if (f.contains('رسمي') || f.contains('formal') || f == 'high') {
      return 'formal';
    }
    if (f.contains('شبه') || f.contains('semi') || f == 'medium') {
      return 'semi_formal';
    }
    if (f.contains('كاجوال') || f.contains('casual') || f == 'low') {
      return 'casual';
    }
    // Numeric-looking values are not dress codes — omit
    if (double.tryParse(f) != null) return null;
    return null;
  }

  static bool _isStale(OutfitAnalysis a) {
    final gate = a.analysisGate.toLowerCase();
    return gate == 'degraded' || gate == 'blocked' || gate == 'stale';
  }

  static String? _upperTypeHint(String clothingType) {
    final t = clothingType.toLowerCase();
    if (t.contains('بلوزة') || t.contains('blouse')) return 'blouse';
    if (t.contains('قميص') || t.contains('shirt')) return 'shirt';
    if (t.contains('فستان') || t.contains('dress')) return 'dress';
    if (t.contains('جاكيت') || t.contains('jacket')) return 'jacket';
    if (clothingType.trim().isEmpty) return null;
    return clothingType;
  }

  static String? _lowerTypeHint(
    String clothingType,
    List<String> pieces,
  ) {
    final blob = ('$clothingType ${pieces.join(' ')}').toLowerCase();
    if (blob.contains('تنورة') || blob.contains('skirt')) return 'skirt';
    if (blob.contains('بنطلون') || blob.contains('pant') || blob.contains('trouser')) {
      return 'pants';
    }
    return null;
  }
}
