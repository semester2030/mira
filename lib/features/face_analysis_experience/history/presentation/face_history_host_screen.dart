import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/mira_report_navigation.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../skin_analysis/data/repositories/skin_analysis_repository_impl.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../skin_analysis/domain/repositories/skin_analysis_repository.dart';
import '../analytics/face_history_analytics.dart';
import '../contracts/face_history_vms.dart';
import '../localization/face_history_copy.dart';
import '../retake/face_retake_policy.dart';
import 'face_history_screen.dart';

/// Loads existing SkinAnalysis history and presents Face history surface.
class FaceHistoryHostScreen extends StatefulWidget {
  const FaceHistoryHostScreen({
    super.key,
    this.currentReportId,
    this.currentReport,
    this.repository,
  });

  final String? currentReportId;
  final SkinReport? currentReport;
  final SkinAnalysisRepository? repository;

  @override
  State<FaceHistoryHostScreen> createState() => _FaceHistoryHostScreenState();
}

class _FaceHistoryHostScreenState extends State<FaceHistoryHostScreen> {
  late Future<List<SkinReport>> _future;
  var _loggedOpen = false;

  @override
  void initState() {
    super.initState();
    _future = (widget.repository ?? SkinAnalysisRepositoryImpl()).getHistory();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<SkinReport>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Scaffold(
            backgroundColor: Color(0xFF121014),
            appBar: MiraAppBar(pageTitle: FaceHistoryCopy.entryTitle),
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snap.hasError) {
          return Scaffold(
            backgroundColor: const Color(0xFF121014),
            appBar: const MiraAppBar(pageTitle: FaceHistoryCopy.entryTitle),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'تعذّر تحميل السجل.',
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.onPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          );
        }

        final reports = snap.data ?? const <SkinReport>[];
        if (!_loggedOpen) {
          _loggedOpen = true;
          FaceHistoryAnalytics.historyOpened();
        }

        // Ensure current report appears even if history fetch missed it.
        final merged = _mergeCurrent(reports);

        return FaceHistoryScreen(
          reports: merged,
          currentReportId: widget.currentReportId ?? widget.currentReport?.id,
          onOpenReport: (report) {
            MiraReportNavigation.openFromHistory(context, report);
          },
          onRetake: AppSession.canBrowse
              ? () {
                  FaceHistoryAnalytics.retakeStarted(
                    FaceRetakePolicy.build(
                      reason: FaceRetakeReason.userRequested,
                      source: FaceRetakeSource.history,
                      currentAnalysisRef: widget.currentReportId,
                    ).source.name,
                  );
                  Navigator.of(context).pop(FaceRetakePolicy.popResult);
                }
              : null,
        );
      },
    );
  }

  List<SkinReport> _mergeCurrent(List<SkinReport> reports) {
    final cur = widget.currentReport;
    if (cur == null || cur.id == null) return reports;
    if (reports.any((r) => r.id == cur.id)) return reports;
    return [cur, ...reports];
  }
}

/// Convenience push — used from Result Mirror.
Future<Object?> openFaceHistory({
  required BuildContext context,
  SkinReport? currentReport,
}) {
  return Navigator.pushNamed(
    context,
    AppRoutes.faceHistory,
    arguments: FaceHistoryRouteArgs(
      currentReportId: currentReport?.id,
      currentReport: currentReport,
    ),
  );
}
