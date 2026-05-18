import 'engine/mira_recommendation_engine.dart';
import 'mocks/mock_outfit_analysis_provider.dart';
import 'mocks/mock_skin_analysis_provider.dart';
import 'providers/outfit_analysis_provider.dart';
import 'providers/skin_analysis_provider.dart';

/// Central registry for AI providers and the recommendation engine.
/// Swap [skinProvider] / [outfitProvider] when API keys are available (Part 2).
class AiModule {
  AiModule._();

  static final AiModule instance = AiModule._();

  SkinAnalysisProvider skinProvider = MockSkinAnalysisProvider();
  OutfitAnalysisProvider outfitProvider = MockOutfitAnalysisProvider();
  final MiraRecommendationEngine recommendationEngine = MiraRecommendationEngine();

  void useMockProviders() {
    skinProvider = MockSkinAnalysisProvider();
    outfitProvider = MockOutfitAnalysisProvider();
  }

  // Future: void useProductionProviders({required String perfectCorpKey, required String fashnKey})
}
