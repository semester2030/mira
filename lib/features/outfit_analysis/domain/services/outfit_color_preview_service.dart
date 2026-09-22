import 'package:flutter/material.dart';

import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../presentation/utils/fashion_color_binding.dart';
import '../entities/outfit_analysis.dart';
import '../entities/outfit_segment_map.dart';
import '../helpers/outfit_arabic_labels.dart';
import '../helpers/outfit_fashion_taxonomy.dart';
import '../helpers/skin_palette_mapper.dart';
import '../helpers/undertone_resolver.dart';

enum OutfitPieceKind {
  shirt,
  blazer,
  dress,
  pants,
  jeans,
  skirt,
  shoes,
  other,
}

class OutfitColorAlternative {
  final String pieceLabelAr;
  final OutfitPieceKind pieceKind;
  final String currentColorAr;
  final Color? currentColor;
  final String? currentColorHex;
  final FashionColorSource currentSource;
  final String alternativeColorAr;
  final Color? alternativeColor;
  final String? alternativeColorHex;
  /// Measured rule-fit delta (proposed − current). Null when not measurable.
  final int? projectedHarmonyDelta;
  final int? projectedOverallDelta;
  final String insightAr;
  /// Machine-readable basis for the recommendation (logged / tests).
  final String reasonCode;
  final bool skinPersonalized;

  const OutfitColorAlternative({
    required this.pieceLabelAr,
    required this.pieceKind,
    required this.currentColorAr,
    required this.currentColor,
    this.currentColorHex,
    this.currentSource = FashionColorSource.unknown,
    required this.alternativeColorAr,
    required this.alternativeColor,
    this.alternativeColorHex,
    required this.projectedHarmonyDelta,
    required this.projectedOverallDelta,
    required this.insightAr,
    this.reasonCode = 'unknown',
    this.skinPersonalized = false,
  });

  bool get hasCurrentSwatch => currentColor != null;
  bool get hasAlternativeSwatch => alternativeColor != null;
  bool get hasMeasuredImprovement => projectedHarmonyDelta != null;
}

abstract final class OutfitColorPreviewService {
  OutfitColorPreviewService._();

  static List<OutfitColorAlternative> alternatives(
    OutfitAnalysis analysis, {
    int max = 4,
    String? garmentLabelAr,
    SkinReport? skin,
  }) {
    final piece = garmentLabelAr != null && garmentLabelAr.trim().isNotEmpty
        ? (garmentLabelAr.trim(), _kindFromLabel(garmentLabelAr))
        : _primaryUpperPiece(analysis);
    if (piece == null) return const [];

    final (label, kind) = piece;
    final bound = FashionColorBinding.forSelectedGarment(
      analysis: analysis,
      garmentLabelAr: label,
    );

    final skinAvailable = skin != null && _hasReliableSkinColorData(skin);
    final palette =
        skinAvailable ? SkinPaletteMapper.fromSkinReport(skin) : null;
    final undertoneAr = palette != null
        ? UndertoneResolver.labelAr(palette.undertone)
        : null;

    final candidates = <String>[
      ...analysis.recommendedColors,
      if (palette != null) ...palette.recommendedPalettes,
    ];

    final seen = <String>{bound.displayNameAr.trim()};
    final out = <OutfitColorAlternative>[];

    for (final altName in candidates) {
      final trimmed = altName.trim();
      if (trimmed.isEmpty || seen.contains(trimmed)) continue;
      if (_sameColorFamily(trimmed, bound.displayNameAr)) continue;
      seen.add(trimmed);

      final altResolved = FashionColorBinding.resolveDetailed(
        nameAr: trimmed,
        source: FashionColorSource.catalog,
      );
      if (!altResolved.isAvailable) continue;

      final fit = _ruleFitDelta(
        currentNameAr: bound.displayNameAr,
        proposedNameAr: trimmed,
        analysis: analysis,
        palette: palette,
      );

      out.add(
        OutfitColorAlternative(
          pieceLabelAr: label,
          pieceKind: kind,
          currentColorAr: bound.isAvailable
              ? (bound.displayNameAr == FashionColorBinding.unavailableLabel
                  ? FashionColorBinding.unavailableLabel
                  : bound.displayNameAr)
              : FashionColorBinding.unavailableLabel,
          currentColor: bound.color,
          currentColorHex: bound.hex,
          currentSource: bound.source,
          alternativeColorAr: trimmed,
          alternativeColor: altResolved.color,
          alternativeColorHex: altResolved.hex,
          projectedHarmonyDelta: fit.delta,
          projectedOverallDelta: fit.delta,
          insightAr: _insightFor(
            alt: trimmed,
            piece: label,
            fit: fit,
            undertoneAr: undertoneAr,
            skinPersonalized: skinAvailable,
            occasionLabelAr: analysis.occasion.labelAr,
          ),
          reasonCode: fit.reasonCode,
          skinPersonalized: skinAvailable,
        ),
      );
      if (out.length >= max) break;
    }

    out.sort((a, b) {
      final da = a.projectedHarmonyDelta ?? -999;
      final db = b.projectedHarmonyDelta ?? -999;
      return db.compareTo(da);
    });
    return out;
  }

  /// Current color for a specific garment — does not consult global top-confidence.
  static FashionColorResolve currentForGarment(
    OutfitAnalysis analysis,
    String garmentLabelAr,
  ) {
    return FashionColorBinding.forSelectedGarment(
      analysis: analysis,
      garmentLabelAr: garmentLabelAr,
    );
  }

  /// Undertone / skinTone fields only — never pores/oiliness as color proxies.
  static bool _hasReliableSkinColorData(SkinReport skin) {
    final undertone =
        '${skin.undertone} ${skin.undertoneEn}'.trim().toLowerCase();
    final tone = '${skin.skinTone} ${skin.skinToneEn}'.trim().toLowerCase();
    if (undertone.isNotEmpty &&
        undertone != 'unknown' &&
        undertone != 'غير معروف') {
      return true;
    }
    if (tone.isNotEmpty && tone != 'unknown' && tone != 'غير معروف') {
      return true;
    }
    return false;
  }

  static (String, OutfitPieceKind)? _primaryUpperPiece(OutfitAnalysis analysis) {
    final regions = analysis.segmentMap?.regions ?? const [];
    for (final region in regions) {
      if (OutfitSegmentMap.isAnatomyBandLabel(region)) continue;
      final label = '${region.labelAr} ${region.labelEn}'.toLowerCase();
      if (label.contains('فستان') ||
          label.contains('dress') ||
          label.contains('gown')) {
        return (region.labelAr, OutfitPieceKind.dress);
      }
    }
    for (final region in regions) {
      if (OutfitSegmentMap.isAnatomyBandLabel(region)) continue;
      if (region.zone == OutfitSegmentZone.upperBody) {
        return (region.labelAr, _kindFromLabel(region.labelAr));
      }
    }
    for (final label in analysis.detectedPieces) {
      if (!OutfitFashionTaxonomy.isFootwear(label) &&
          !OutfitFashionTaxonomy.isBag(label) &&
          !OutfitFashionTaxonomy.isAccessory(label)) {
        return (label, _kindFromLabel(label));
      }
    }
    if (analysis.clothingType.isNotEmpty) {
      return (analysis.clothingType, _kindFromLabel(analysis.clothingType));
    }
    return null;
  }

  static OutfitPieceKind _kindFromLabel(String label) {
    final lower = label.toLowerCase();
    if (lower.contains('فستان') || lower.contains('dress')) {
      return OutfitPieceKind.dress;
    }
    if (lower.contains('بلوز') ||
        lower.contains('جاك') ||
        lower.contains('blazer')) {
      return OutfitPieceKind.blazer;
    }
    if (lower.contains('تيش') ||
        lower.contains('قمي') ||
        lower.contains('shirt')) {
      return OutfitPieceKind.shirt;
    }
    if (lower.contains('جين') || lower.contains('jean')) {
      return OutfitPieceKind.jeans;
    }
    if (lower.contains('بنط') || lower.contains('pant')) {
      return OutfitPieceKind.pants;
    }
    if (lower.contains('تنورة') || lower.contains('skirt')) {
      return OutfitPieceKind.skirt;
    }
    return OutfitPieceKind.other;
  }

  /// Documented rule-fit comparison — never invent +12% for list membership.
  static ({int? delta, String reasonCode}) _ruleFitDelta({
    required String currentNameAr,
    required String proposedNameAr,
    required OutfitAnalysis analysis,
    required SkinPaletteProfile? palette,
  }) {
    final currentScore = _fitScore(currentNameAr, analysis, palette);
    final proposedScore = _fitScore(proposedNameAr, analysis, palette);
    if (currentScore == null || proposedScore == null) {
      return (delta: null, reasonCode: 'unmeasured_no_inputs');
    }
    final delta = (proposedScore - currentScore).round().clamp(-25, 25);
    final code = palette != null
        ? 'skin_occasion_rule_delta'
        : 'occasion_outfit_rule_delta';
    return (delta: delta, reasonCode: code);
  }

  static double? _fitScore(
    String colorName,
    OutfitAnalysis analysis,
    SkinPaletteProfile? palette,
  ) {
    final name = colorName.trim();
    if (name.isEmpty || name == FashionColorBinding.unavailableLabel) {
      return null;
    }
    var score = 50.0;

    // Occasion affinity from engine lists (same inputs as recommendations).
    if (analysis.recommendedColors.any((c) => _sameColorFamily(c, name))) {
      score += 10;
    }
    if (analysis.rejectedColors.any((c) => _sameColorFamily(c, name))) {
      score -= 14;
    }

    if (palette != null) {
      if (palette.recommendedPalettes
          .any((c) => _sameColorFamily(c, name))) {
        score += 12;
      }
      if (palette.blockedPalettes.any((c) => _sameColorFamily(c, name))) {
        score -= 16;
      }
    }

    // Other pieces' palette — prefer complement, mild penalty for clone.
    final others = <String>[
      ...analysis.dominantColors,
      ...analysis.upperBodyColors,
      ...analysis.lowerBodyColors,
    ];
    if (others.any((c) => _sameColorFamily(c, name))) {
      score -= 3;
    }

    return score.clamp(0, 100);
  }

  static bool _sameColorFamily(String a, String b) {
    final na = a.trim();
    final nb = b.trim();
    if (na.isEmpty ||
        nb.isEmpty ||
        na == FashionColorBinding.unavailableLabel ||
        nb == FashionColorBinding.unavailableLabel) {
      return false;
    }
    if (na == nb) return true;
    return na.contains(nb) || nb.contains(na);
  }

  static String _insightFor({
    required String alt,
    required String piece,
    required ({int? delta, String reasonCode}) fit,
    required String? undertoneAr,
    required bool skinPersonalized,
    required String occasionLabelAr,
  }) {
    final label = OutfitArabicLabels.garmentLabel(piece);
    final occasionBit = occasionLabelAr.isNotEmpty
        ? ' لمناسبة «$occasionLabelAr»'
        : '';

    if (skinPersonalized && undertoneAr != null) {
      if (fit.delta != null && fit.delta! >= 8) {
        return 'نقترح $alt على $label$occasionBit لأنه أقرب لتدرج بشرتك ($undertoneAr) من اللون الحالي حسب قواعد اللوحة.';
      }
      return 'اقتراح $alt على $label$occasionBit مبني على تدرج بشرتك ($undertoneAr) وألوان الإطلالة الحالية.';
    }

    // No skin basis — never claim «يناسب بشرتك».
    if (fit.delta != null && fit.delta! >= 8) {
      return 'نقترح $alt على $label$occasionBit لتحسين تناسق الألوان مع بقية القطع — غير مخصص للبشرة (لا يتوفر تحليل لون بشرة موثوق).';
    }
    return 'اقتراح $alt على $label$occasionBit من قواعد المناسبة والملابس — غير مخصص للبشرة.';
  }
}
