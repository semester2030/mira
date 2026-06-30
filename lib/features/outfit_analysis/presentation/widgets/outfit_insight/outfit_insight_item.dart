import 'package:flutter/material.dart';

/// Visual category for illustrated outfit insight tiles.
enum OutfitVisualKind {
  blazer,
  shirt,
  jeans,
  pants,
  dress,
  skirt,
  shoes,
  bag,
  watch,
  necklace,
  sunglasses,
  scarf,
  makeupCompact,
  lipstick,
  eyeshadow,
}

/// One dynamic insight tile — label + colors derived from analysis.
class OutfitInsightItem {
  final String labelAr;
  final OutfitVisualKind kind;
  final Color primary;
  final Color accent;
  final String? subtitleAr;

  const OutfitInsightItem({
    required this.labelAr,
    required this.kind,
    required this.primary,
    required this.accent,
    this.subtitleAr,
  });
}

/// Named color swatch for the palette row.
class OutfitPaletteSwatch {
  final String nameAr;
  final Color color;

  const OutfitPaletteSwatch({required this.nameAr, required this.color});
}
