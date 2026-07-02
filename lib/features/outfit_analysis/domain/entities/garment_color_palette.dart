import '../entities/detected_garment_color.dart';

/// Garment-only palette extracted from segmented clothing pixels.
class GarmentColorPalette {
  final String primaryColor;
  final String secondaryColor;
  final String accentColor;
  final double confidence;
  final List<String> allColors;
  final List<DetectedGarmentColor> detailedColors;

  const GarmentColorPalette({
    required this.primaryColor,
    required this.secondaryColor,
    required this.accentColor,
    required this.confidence,
    this.allColors = const [],
    this.detailedColors = const [],
  });

  static const empty = GarmentColorPalette(
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
    confidence: 0,
  );

  bool get isReliable => confidence >= 0.72 && primaryColor.isNotEmpty;

  List<String> get ordered => [
        if (primaryColor.isNotEmpty) primaryColor,
        if (secondaryColor.isNotEmpty && secondaryColor != primaryColor) secondaryColor,
        if (accentColor.isNotEmpty &&
            accentColor != primaryColor &&
            accentColor != secondaryColor)
          accentColor,
      ];

  DetectedGarmentColor? get primaryDetail =>
      detailedColors.isNotEmpty ? detailedColors.first : null;
}
