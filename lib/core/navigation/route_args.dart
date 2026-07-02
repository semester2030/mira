import '../../features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';
import '../../features/outfit_analysis/domain/entities/outfit_compare_snapshot.dart';
import '../../features/outfit_analysis/domain/entities/outfit_analysis.dart';
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
  final SkinReport? skinReport;
  final OutfitAnalysis? outfitAnalysis;
  final String? outfitAnalysisId;
  final String? recolorAttemptId;
  final String? initialQuestion;

  const AdvisorRouteArgs({
    this.skinReport,
    this.outfitAnalysis,
    this.outfitAnalysisId,
    this.recolorAttemptId,
    this.initialQuestion,
  });

  /// Skin-only legacy entry (Phase 2).
  factory AdvisorRouteArgs.skin(SkinReport report, {String? initialQuestion}) {
    return AdvisorRouteArgs(
      skinReport: report,
      initialQuestion: initialQuestion,
    );
  }

  /// Atelier QEL recolor consultation (Phase 4).
  factory AdvisorRouteArgs.atelier({
    required String recolorAttemptId,
    SkinReport? skinReport,
    OutfitAnalysis? outfitAnalysis,
    String? initialQuestion,
  }) {
    return AdvisorRouteArgs(
      recolorAttemptId: recolorAttemptId,
      skinReport: skinReport,
      outfitAnalysis: outfitAnalysis,
      initialQuestion: initialQuestion,
    );
  }
}

class OutfitCompareRouteArgs {
  final OutfitCompareSnapshot left;
  final OutfitCompareSnapshot right;

  const OutfitCompareRouteArgs({required this.left, required this.right});
}

class OutfitHistoryRouteArgs {
  final OutfitCompareSnapshot? anchorSnapshot;
  final bool startCompareMode;

  const OutfitHistoryRouteArgs({
    this.anchorSnapshot,
    this.startCompareMode = false,
  });
}
