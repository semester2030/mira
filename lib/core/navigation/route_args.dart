import '../../features/face_analysis_experience/advisor_context/contracts/face_advisor_context.dart';
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
  /// When true, always open legacy long report (e.g. details from v2 summary).
  final bool forceLegacy;
  /// Optional stale banner on results_v2 first surface.
  final bool isStale;
  /// Phase 9F — short-lived capture hold path for Result Mirror continuity.
  final String? captureImagePath;
  /// Phase 9F — true only for post-analysis navigation (not history).
  final bool fromFreshAnalysis;
  /// Phase 9J — open Result Mirror for a historical analysis (read projection of that report).
  final bool fromHistory;

  const MiraReportRouteArgs({
    required this.report,
    this.celebrate = false,
    this.forceLegacy = false,
    this.isStale = false,
    this.captureImagePath,
    this.fromFreshAnalysis = false,
    this.fromHistory = false,
  });
}

class AdvisorRouteArgs {
  final SkinReport? skinReport;
  final OutfitAnalysis? outfitAnalysis;
  final String? outfitAnalysisId;
  final String? recolorAttemptId;
  final String? initialQuestion;
  /// Phase 9I — Face Result / Guidance context for frozen Advisor chat.
  final FaceAdvisorContext? faceContext;

  const AdvisorRouteArgs({
    this.skinReport,
    this.outfitAnalysis,
    this.outfitAnalysisId,
    this.recolorAttemptId,
    this.initialQuestion,
    this.faceContext,
  });

  /// Skin-only legacy entry (Phase 2).
  factory AdvisorRouteArgs.skin(SkinReport report, {String? initialQuestion}) {
    return AdvisorRouteArgs(
      skinReport: report,
      initialQuestion: initialQuestion,
    );
  }

  /// Phase 9I — Face contextual Ask Mira (canonical Advisor path).
  factory AdvisorRouteArgs.face({
    required SkinReport report,
    required FaceAdvisorContext faceContext,
    String? initialQuestion,
  }) {
    return AdvisorRouteArgs(
      skinReport: report,
      faceContext: faceContext,
      initialQuestion: initialQuestion ?? faceContext.initialQuestionAr,
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

/// Phase 9J — Face analysis history host.
class FaceHistoryRouteArgs {
  final String? currentReportId;
  final SkinReport? currentReport;

  const FaceHistoryRouteArgs({
    this.currentReportId,
    this.currentReport,
  });
}
