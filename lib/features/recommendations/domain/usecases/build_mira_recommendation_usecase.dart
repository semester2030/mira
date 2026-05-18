import '../../../../core/ai/engine/mira_recommendation_engine.dart';
import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/ai/models/mira_recommendation.dart';
import '../../../../core/ai/models/outfit_analysis_result.dart';
import '../../../../core/ai/models/skin_analysis_result.dart';
import '../../../../core/ai/mappers/outfit_result_mapper.dart';
import '../../../../core/ai/mappers/skin_result_mapper.dart';
import '../../../../core/config/mira_api_config.dart';
import '../../data/datasources/recommendations_api_data_source.dart';
import '../../../outfit_analysis/domain/entities/outfit_report.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';

/// Builds unified Mira recommendations from skin and optional outfit results.
class BuildMiraRecommendationUseCase {
  final MiraRecommendationEngine _engine;
  final RecommendationsApiDataSource? _apiDataSource;

  BuildMiraRecommendationUseCase({
    MiraRecommendationEngine? engine,
    RecommendationsApiDataSource? apiDataSource,
  })  : _engine = engine ?? MiraRecommendationEngine(),
        _apiDataSource = MiraApiConfig.useBackend
            ? (apiDataSource ?? RecommendationsApiDataSource())
            : null;

  Future<MiraRecommendation> fromResults({
    required SkinAnalysisResult skin,
    OutfitAnalysisResult? outfit,
    MiraOccasion? occasion,
  }) async {
    if (MiraApiConfig.useBackend) {
      return _apiDataSource!.build(skin: skin, outfit: outfit, occasion: occasion);
    }
    return _engine.build(skin: skin, outfit: outfit, occasion: occasion);
  }

  Future<MiraRecommendation> fromReports({
    required SkinReport skinReport,
    OutfitReport? outfitReport,
    MiraOccasion? occasion,
  }) {
    return fromResults(
      skin: SkinResultMapper.fromReport(skinReport),
      outfit: outfitReport != null ? OutfitResultMapper.fromReport(outfitReport) : null,
      occasion: occasion ?? (outfitReport != null ? MiraOccasion.fromId(outfitReport.occasionId) : null),
    );
  }
}
