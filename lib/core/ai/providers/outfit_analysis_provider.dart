import '../models/mira_occasion.dart';
import '../models/outfit_analysis_result.dart';

/// Abstraction for outfit AI providers (FASHN.ai, Style DNA, Style.me).
abstract class OutfitAnalysisProvider {
  Future<OutfitAnalysisResult> analyze({
    required List<int> imageBytes,
    required MiraOccasion occasion,
  });
}
