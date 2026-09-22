import 'package:flutter/material.dart';

import '../../../../core/config/mira_features.dart';
import '../../../face_analysis_experience/presentation/result/result_mirror.dart';
import '../../../intelligence/presentation/screens/mira_beauty_report_screen.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../domain/perfect_mask_session.dart';
import '../../flags/mira_results_experience_flag.dart';
import '../screens/results_executive_summary_screen.dart';
import '../screens/skin_interactive_report_screen.dart';

/// Feature-flagged entry for `/mira-beauty-report` and `/skin-result`.
/// P5 2026-09-09: Skin Interactive Report is the primary consumer Skin UX.
class ResultsReportEntry extends StatelessWidget {
  const ResultsReportEntry({
    super.key,
    required this.report,
    this.showCelebration = true,
    this.forceLegacy = false,
    this.isStale = false,
    this.captureImagePath,
    this.fromFreshAnalysis = false,
    this.fromHistory = false,
    this.perfectMaskSession,
  });

  final SkinReport report;
  final bool showCelebration;
  final bool forceLegacy;
  final bool isStale;
  final String? captureImagePath;
  final bool fromFreshAnalysis;
  final bool fromHistory;
  final PerfectMaskSession? perfectMaskSession;

  @override
  Widget build(BuildContext context) {
    // MIRA-P5-STRICT-FRONTEND-RECOVERY-2026-09-14:
    // When interactive Skin UX is on, never silently fall back to legacy purple
    // MiraBeautyReportScreen — including forceLegacy / missing-mask cases.
    // Face Explorer stays active; unavailable mask state is handled inside it.
    if (MiraFeatures.skinInteractiveReportV1) {
      return SkinInteractiveReportScreen(
        report: report,
        showCelebration: showCelebration,
        isStale: isStale,
        captureImagePath: captureImagePath,
        fromHistory: fromHistory,
        perfectMaskSession: fromHistory ? null : perfectMaskSession,
      );
    }

    if (!forceLegacy &&
        FaceResultMirrorFlag.enabled &&
        (fromFreshAnalysis || fromHistory)) {
      return ResultsFaceMirrorScreen(
        report: report,
        captureImagePath: captureImagePath,
        showCelebration: showCelebration && fromFreshAnalysis,
      );
    }

    final useV2 =
        !forceLegacy && MiraResultsExperienceFlagStore.current.isResultsV2;

    if (!useV2) {
      return MiraBeautyReportScreen(
        report: report,
        showCelebration: showCelebration,
      );
    }

    return ResultsExecutiveSummaryScreen(
      report: report,
      showCelebration: showCelebration,
      isStale: isStale,
    );
  }
}
