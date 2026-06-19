import '../../features/outfit_analysis/domain/entities/outfit_analysis.dart';
import '../../features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';
import '../../features/outfit_analysis/domain/entities/outfit_report.dart';
import '../../features/skin_analysis/domain/entities/skin_report.dart';

class RecommendationRouteArgs {
  final SkinReport? skin;
  final OutfitReport? outfit;

  const RecommendationRouteArgs({this.skin, this.outfit});
}

class OutfitLiveCaptureRouteArgs {
  final OutfitAnalysisMode mode;

  const OutfitLiveCaptureRouteArgs({required this.mode});
}

class OutfitOccasionRouteArgs {
  final String imagePath;
  final OutfitAnalysisMode mode;

  const OutfitOccasionRouteArgs({
    required this.imagePath,
    required this.mode,
  });
}

class MiraReportRouteArgs {
  final SkinReport report;
  final bool celebrate;

  const MiraReportRouteArgs({
    required this.report,
    this.celebrate = false,
  });
}

class AdvisorRouteArgs {
  final SkinReport report;
  final String? initialQuestion;

  const AdvisorRouteArgs({
    required this.report,
    this.initialQuestion,
  });
}
