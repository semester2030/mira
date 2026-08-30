import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../presentation/result/tokens/face_result_tokens.dart';
import '../analytics/face_history_analytics.dart';
import '../assembler/face_comparison_assembler.dart';
import '../assembler/face_history_assembler.dart';
import '../contracts/face_history_vms.dart';
import '../localization/face_history_copy.dart';
import 'face_comparison_sheet.dart';

/// Compact Face analysis history — chronology, not gamified progress.
class FaceHistoryScreen extends StatelessWidget {
  const FaceHistoryScreen({
    super.key,
    required this.reports,
    this.currentReportId,
    required this.onOpenReport,
    this.onRetake,
  });

  final List<SkinReport> reports;
  final String? currentReportId;
  final void Function(SkinReport report) onOpenReport;
  final VoidCallback? onRetake;

  @override
  Widget build(BuildContext context) {
    final surface = const FaceHistoryAssembler().build(
      reports: reports,
      currentReportId: currentReportId,
    );

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFF121014),
        appBar: const MiraAppBar(pageTitle: FaceHistoryCopy.entryTitle),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  surface.headlineAr,
                  style: AppTypography.titleMedium.copyWith(
                    color: FaceResultTokens.onGlass,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  surface.supportAr,
                  style: AppTypography.bodySmall.copyWith(
                    color: FaceResultTokens.qualifier,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: surface.empty
                      ? _Empty(onRetake: onRetake)
                      : ListView.separated(
                          itemCount: surface.entries.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, i) {
                            final entry = surface.entries[i];
                            final report = _reportFor(entry);
                            return _HistoryTile(
                              entry: entry,
                              selected: entry.reportId == currentReportId,
                              onOpen: report == null
                                  ? null
                                  : () {
                                      FaceHistoryAnalytics.entryOpened(
                                        entry.entryId,
                                      );
                                      onOpenReport(report);
                                    },
                            );
                          },
                        ),
                ),
                if (surface.comparisonAvailable &&
                    reports.length >= 2 &&
                    currentReportId != null) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(
                    key: const Key('face_history_compare'),
                    onPressed: () {
                      SkinReport? cur;
                      for (final r in reports) {
                        if (r.id == currentReportId) {
                          cur = r;
                          break;
                        }
                      }
                      cur ??= reports.isEmpty ? null : reports.first;
                      if (cur != null) _openCompare(context, cur);
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: FaceResultTokens.onGlass,
                      side: BorderSide(color: FaceResultTokens.glassBorder),
                    ),
                    child: const Text(FaceHistoryCopy.compareWithPrevious),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  SkinReport? _reportFor(FaceHistoryEntryVm entry) {
    for (final r in reports) {
      if (r.id != null && r.id == entry.reportId) return r;
    }
    return null;
  }

  Future<void> _openCompare(BuildContext context, SkinReport current) async {
    HapticFeedback.selectionClick();
    const hist = FaceHistoryAssembler();
    const cmp = FaceComparisonAssembler();
    final surface = hist.build(reports: reports);
    final currentEntry = hist.entryFromReport(current);
    if (currentEntry == null) return;
    final baseline = cmp.selectBaseline(
      entriesNewestFirst: surface.entries,
      current: currentEntry,
    );
    if (baseline == null) {
      final blocked = FaceComparisonVm(
        comparisonId: 'cmp_no_baseline_${currentEntry.analysisId}',
        currentAnalysisRef: currentEntry.analysisId,
        previousAnalysisRef: 'none',
        gate: FaceComparabilityGate.notComparable,
        comparisonReasonAr: FaceHistoryCopy.incompatibleHeadline,
        comparableItems: const [],
        historicalOnlyItems: const [],
        limitationsAr: const [FaceHistoryCopy.incompatibleSupport],
        currentCapturedAt: currentEntry.capturedAt,
      );
      FaceHistoryAnalytics.comparisonOpened(blocked.gate.name);
      await showFaceComparisonSheet(context: context, comparison: blocked);
      return;
    }
    SkinReport? prev;
    for (final r in reports) {
      if (r.id == baseline.reportId) {
        prev = r;
        break;
      }
    }
    if (prev == null) return;
    final vm = cmp.build(currentReport: current, previousReport: prev);
    FaceHistoryAnalytics.comparisonOpened(vm.gate.name);
    await showFaceComparisonSheet(context: context, comparison: vm);
  }
}

class _Empty extends StatelessWidget {
  const _Empty({this.onRetake});
  final VoidCallback? onRetake;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            FaceHistoryCopy.emptyHeadline,
            key: const Key('face_history_empty'),
            style: AppTypography.titleSmall.copyWith(
              color: FaceResultTokens.onGlass,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            FaceHistoryCopy.emptySupport,
            textAlign: TextAlign.center,
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.qualifier,
            ),
          ),
          if (onRetake != null) ...[
            const SizedBox(height: 16),
            TextButton(
              onPressed: onRetake,
              child: const Text(FaceHistoryCopy.retakeLabel),
            ),
          ],
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({
    required this.entry,
    required this.selected,
    this.onOpen,
  });

  final FaceHistoryEntryVm entry;
  final bool selected;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final date = entry.capturedAt;
    final dateLabel = date == null
        ? '—'
        : '${date.year}/${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}';

    return Semantics(
      button: onOpen != null,
      label: '${entry.primaryLabelAr}. $dateLabel. ${entry.qualityLabelAr}',
      child: InkWell(
        key: Key('face_history_entry_${entry.entryId}'),
        onTap: onOpen,
        borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: FaceResultTokens.glass,
            borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
            border: Border.all(
              color: selected
                  ? FaceResultTokens.pearl.withValues(alpha: 0.5)
                  : FaceResultTokens.glassBorder,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      entry.primaryLabelAr,
                      style: AppTypography.titleSmall.copyWith(
                        color: FaceResultTokens.onGlass,
                      ),
                    ),
                  ),
                  Text(
                    dateLabel,
                    style: AppTypography.bodySmall.copyWith(
                      color: FaceResultTokens.qualifier,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                entry.qualityLabelAr,
                style: AppTypography.bodySmall.copyWith(
                  color: FaceResultTokens.qualifier,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
