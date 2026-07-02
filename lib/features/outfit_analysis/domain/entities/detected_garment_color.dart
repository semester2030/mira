import 'professional_color_matcher.dart';

/// Rich garment color detection result (Delta-E grounded).
class DetectedGarmentColor {
  final String id;
  final String nameAr;
  final String displayNameAr;
  final String hex;
  final double deltaE;
  final double confidence;
  final String matchTierAr;
  final String shadeAr;

  const DetectedGarmentColor({
    required this.id,
    required this.nameAr,
    required this.displayNameAr,
    required this.hex,
    required this.deltaE,
    required this.confidence,
    required this.matchTierAr,
    required this.shadeAr,
  });

  factory DetectedGarmentColor.fromMatch(ProfessionalColorMatch match) {
    return DetectedGarmentColor(
      id: match.id,
      nameAr: match.nameAr,
      displayNameAr: match.displayNameAr,
      hex: match.hex,
      deltaE: match.deltaE,
      confidence: match.confidence,
      matchTierAr: match.matchTierAr,
      shadeAr: match.shadeAr,
    );
  }
}
