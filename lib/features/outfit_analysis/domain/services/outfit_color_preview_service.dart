import 'package:flutter/material.dart';

import '../../data/helpers/vision_color_mapper.dart';
import '../entities/outfit_analysis.dart';
import '../entities/outfit_segment_map.dart';
import '../helpers/outfit_arabic_labels.dart';
import '../helpers/outfit_fashion_taxonomy.dart';

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
  final Color currentColor;
  final String alternativeColorAr;
  final Color alternativeColor;
  final int projectedHarmonyDelta;
  final int projectedOverallDelta;
  final String insightAr;

  const OutfitColorAlternative({
    required this.pieceLabelAr,
    required this.pieceKind,
    required this.currentColorAr,
    required this.currentColor,
    required this.alternativeColorAr,
    required this.alternativeColor,
    required this.projectedHarmonyDelta,
    required this.projectedOverallDelta,
    required this.insightAr,
  });
}

abstract final class OutfitColorPreviewService {
  OutfitColorPreviewService._();

  static List<OutfitColorAlternative> alternatives(OutfitAnalysis analysis, {int max = 4}) {
    final piece = _primaryUpperPiece(analysis);
    if (piece == null) return const [];

    final (label, kind) = piece;
    final currentName = analysis.upperBodyColors.isNotEmpty
        ? analysis.upperBodyColors.first
        : (analysis.dominantColors.isNotEmpty ? analysis.dominantColors.first : 'بيج');
    final currentColor = VisionColorMapper.toDisplayColor(currentName);

    final candidates = <String>[
      ...analysis.recommendedColors,
      ...analysis.dominantColors.where((c) => !analysis.rejectedColors.contains(c)),
    ];

    final seen = <String>{currentName.trim()};
    final out = <OutfitColorAlternative>[];

    for (final altName in candidates) {
      final trimmed = altName.trim();
      if (trimmed.isEmpty || seen.contains(trimmed)) continue;
      seen.add(trimmed);

      final harmonyDelta = _harmonyDelta(trimmed, analysis);
      final overallDelta = (harmonyDelta * 0.45).round();

      out.add(
        OutfitColorAlternative(
          pieceLabelAr: label,
          pieceKind: kind,
          currentColorAr: currentName,
          currentColor: currentColor,
          alternativeColorAr: trimmed,
          alternativeColor: VisionColorMapper.toDisplayColor(trimmed),
          projectedHarmonyDelta: harmonyDelta,
          projectedOverallDelta: overallDelta,
          insightAr: _insightFor(trimmed, harmonyDelta, label),
        ),
      );
      if (out.length >= max) break;
    }

    out.sort((a, b) => b.projectedHarmonyDelta.compareTo(a.projectedHarmonyDelta));
    return out;
  }

  static (String, OutfitPieceKind)? _primaryUpperPiece(OutfitAnalysis analysis) {
    final regions = analysis.segmentMap?.regions ?? const [];
    for (final region in regions) {
      final label = '${region.labelAr} ${region.labelEn}'.toLowerCase();
      if (label.contains('فستان') || label.contains('dress') || label.contains('gown')) {
        return (region.labelAr, OutfitPieceKind.dress);
      }
    }
    for (final region in regions) {
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
    if (lower.contains('فستان') || lower.contains('dress')) return OutfitPieceKind.dress;
    if (lower.contains('بلوز') || lower.contains('جاك') || lower.contains('blazer')) {
      return OutfitPieceKind.blazer;
    }
    if (lower.contains('تيش') || lower.contains('قمي') || lower.contains('shirt')) {
      return OutfitPieceKind.shirt;
    }
    if (lower.contains('جين') || lower.contains('jean')) return OutfitPieceKind.jeans;
    if (lower.contains('بنط') || lower.contains('pant')) return OutfitPieceKind.pants;
    if (lower.contains('تنورة') || lower.contains('skirt')) return OutfitPieceKind.skirt;
    return OutfitPieceKind.other;
  }

  static int _harmonyDelta(String altColor, OutfitAnalysis analysis) {
    var delta = 0;
    if (analysis.recommendedColors.any((c) => _sameColorFamily(c, altColor))) delta += 12;
    if (analysis.rejectedColors.any((c) => _sameColorFamily(c, altColor))) delta -= 14;
    if (analysis.dominantColors.any((c) => _sameColorFamily(c, altColor))) delta -= 4;
    if (delta == 0) delta = 5;
    return delta.clamp(-18, 18);
  }

  static bool _sameColorFamily(String a, String b) {
    final na = a.trim();
    final nb = b.trim();
    if (na == nb) return true;
    return na.contains(nb) || nb.contains(na);
  }

  static String _insightFor(String alt, int delta, String piece) {
    final label = OutfitArabicLabels.garmentLabel(piece);
    if (delta >= 10) {
      return 'لون $alt على $label يرفع انسجام الألوان مع بشرتك';
    }
    if (delta >= 4) {
      return 'لمسة $alt على $label تنعّم التوازن اللوني';
    }
    if (delta <= -8) {
      return 'تجنّبي $alt على $label — قد يتعارض مع تدرج بشرتك';
    }
    return 'جرّبي $alt على $label وقارني الإحساس العام';
  }
}
