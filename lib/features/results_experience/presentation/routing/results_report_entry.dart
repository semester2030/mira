import 'package:flutter/material.dart';

import '../../../face_analysis_experience/presentation/result/result_mirror.dart';
import '../../../intelligence/presentation/screens/mira_beauty_report_screen.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../flags/mira_results_experience_flag.dart';
import '../screens/results_executive_summary_screen.dart';

/// Feature-flagged entry for `/mira-beauty-report` and `/skin-result`.
/// Default: legacy long report. results_v2: executive first surface only.
/// Phase 9F: Interactive Result Mirror when flag ON + fresh analysis.
/// Phase 9J: also for historical opens (`fromHistory`) — same report projection.
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
  });

  final SkinReport report;
  final bool showCelebration;
  final bool forceLegacy;
  final bool isStale;
  final String? captureImagePath;
  final bool fromFreshAnalysis;
  final bool fromHistory;

  @override
  Widget build(BuildContext context) {
    if (!forceLegacy &&
        FaceResultMirrorFlag.enabled &&
        (fromFreshAnalysis || fromHistory)) {
      return ResultsFaceMirrorScreen(
        report: report,
        captureImagePath: captureImagePath,
        showCelebration: showCelebration && fromFreshAnalysis,
      );
    }

    final useV2 = !forceLegacy &&
        MiraResultsExperienceFlagStore.current.isResultsV2;

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
