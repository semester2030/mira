import '../models/skin_analysis_result.dart';

/// Abstraction for skin AI providers (Perfect Corp, Revieve, Haut.AI).
abstract class SkinAnalysisProvider {
  /// Analyzes face image bytes. No persistence — caller handles storage.
  Future<SkinAnalysisResult> analyze(List<int> imageBytes);
}
