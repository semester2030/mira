import '../entities/outfit_analysis.dart';
import '../entities/outfit_visual_profile.dart';

abstract final class OutfitVisualFromAnalysis {
  OutfitVisualFromAnalysis._();

  static OutfitVisualProfile toVisualProfile(OutfitAnalysis analysis) {
    return OutfitVisualProfile(
      labels: analysis.visionLabels,
      dominantColors: analysis.dominantColors,
      clothingTypes: analysis.detectedPieces,
      styleSignals: analysis.styleType.isNotEmpty ? [analysis.styleType] : const [],
      confidence: analysis.visualConfidence,
      source: analysis.visualSource,
      garmentTypeAr: analysis.clothingType,
      styleTypeAr: analysis.styleType,
      contrastLevel: _parseLevel(analysis.contrastLevel, high: 0.78, mid: 0.55, low: 0.32),
      formalityLevel: _parseFormality(analysis.formalityLevel),
    );
  }

  static double _parseLevel(
    String raw, {
    required double high,
    required double mid,
    required double low,
  }) {
    final trimmed = raw.trim();
    final numeric = double.tryParse(trimmed);
    if (numeric != null) return numeric.clamp(0.0, 1.0);
    if (trimmed.contains('عال') || trimmed.contains('high')) return high;
    if (trimmed.contains('متوسط') || trimmed.contains('medium') || trimmed.contains('شبه')) {
      return mid;
    }
    if (trimmed.contains('منخفض') || trimmed.contains('low')) return low;
    return mid;
  }

  static double _parseFormality(String raw) {
    final trimmed = raw.trim();
    final numeric = double.tryParse(trimmed);
    if (numeric != null) return numeric.clamp(0.0, 1.0);
    if (trimmed.contains('رسمي') && !trimmed.contains('شبه')) return 0.78;
    if (trimmed.contains('شبه')) return 0.58;
    if (trimmed.contains('كاج') || trimmed.contains('casual')) return 0.35;
    return 0.5;
  }
}
