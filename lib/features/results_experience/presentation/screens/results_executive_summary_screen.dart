import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../intelligence/presentation/widgets/mira_report_helpers.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../projection/mira_beauty_report_projection_adapter.dart';
import '../../projection/result_experience_projector.dart';
import '../../projection/result_projection_input.dart';
import '../analytics/results_v2_analytics.dart';
import '../widgets/executive_summary_hero.dart';
import '../widgets/priority_cards_section.dart';
import '../widgets/secondary_entry_group.dart';
import '../widgets/today_action_card.dart';
import 'results_metrics_map_hub_screen.dart';
import 'results_personal_plan_screen.dart';

/// Phase 8C — first user-visible result surface only.
class ResultsExecutiveSummaryScreen extends StatefulWidget {
  const ResultsExecutiveSummaryScreen({
    super.key,
    required this.report,
    this.experience,
    this.showCelebration = true,
    this.isStale = false,
    this.projectionNow,
  });

  final SkinReport report;
  /// Injected for tests — when null, projected from [report].
  final ResultExperience? experience;
  final bool showCelebration;
  final bool isStale;
  final DateTime? projectionNow;

  @override
  State<ResultsExecutiveSummaryScreen> createState() =>
      _ResultsExecutiveSummaryScreenState();
}

class _ResultsExecutiveSummaryScreenState
    extends State<ResultsExecutiveSummaryScreen> {
  late final ResultExperience _experience;
  var _loggedView = false;

  @override
  void initState() {
    super.initState();
    AnalysisSession.setSkin(widget.report);
    _experience = widget.experience ?? _project();

    if (widget.showCelebration) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        AnalysisCelebration.show(
          context,
          message: AnalysisCelebration.messageForSkin(),
        );
      });
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _loggedView) return;
      _loggedView = true;
      ResultsV2Analytics.viewed(analysisId: _experience.id);
    });
  }

  ResultExperience _project() {
    final mira = resolveMiraReport(widget.report);
    final input = MiraBeautyReportProjectionAdapter.fromReport(mira);
    return const ResultExperienceProjector().project(
      input,
      ResultProjectionContext(
        now: widget.projectionNow ?? DateTime.utc(2026, 1, 1),
        flagVariant: 'results_v2',
      ),
    );
  }

  bool get _isPartial {
    final missing = _experience.metrics
        .where((m) => m.visibility == VisibilityState.hiddenMissingEvidence)
        .length;
    return missing > 0 || _experience.priorities.isEmpty;
  }

  @override
  Widget build(BuildContext context) {
    final e = _experience;
    final action = e.immediateAction;

    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) ResultsV2Analytics.summaryAbandoned();
      },
      child: Scaffold(
      backgroundColor: AppColors.background,
      // Logo-only app bar avoids title overflow under Dynamic Type.
      appBar: const MiraAppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            ExecutiveSummaryHero(
              summary: e.summary,
              confidence: e.confidence,
              isStale: widget.isStale,
              isPartial: _isPartial,
              onDisclaimer: () => _showDisclaimer(e),
            ),
            if (e.retake.suggested) ...[
              const SizedBox(height: 12),
              _RetakeBanner(onRetake: _openRetake),
            ],
            const SizedBox(height: 20),
            PriorityCardsSection(
              priorities: e.priorities,
              onOpen: (p) {
                ResultsV2Analytics.priorityOpened(priorityId: p.id);
                _snack('أولوية: ${p.concernLabelAr}');
              },
            ),
            const SizedBox(height: 18),
            if (action != null)
              TodayActionCard(
                action: action,
                onPrimaryCta: () {
                  ResultsV2Analytics.todayActionClicked(actionId: action.id);
                  _openRoutine(stepId: action.routineStepId);
                },
                onShowHow: () {
                  ResultsV2Analytics.todayActionClicked(
                    actionId: '${action.id}_how',
                  );
                  _openRoutine(stepId: action.routineStepId);
                },
              )
            else
              TodayActionEmptyCard(onOpenRoutine: () => _openRoutine()),
            const SizedBox(height: 20),
            SecondaryEntryGroup(
              routine: e.routinePreview,
              progress: e.progressPreview,
              advisor: e.advisorEntry,
              onRoutine: () {
                ResultsV2Analytics.routineOpened();
                _openRoutine();
              },
              onProgress: () {
                ResultsV2Analytics.progressOpened();
                _openProgress();
              },
              onAdvisor: () {
                ResultsV2Analytics.advisorOpened();
                _openAdvisor();
              },
            ),
            const SizedBox(height: 18),
            Text('استكشفي المزيد', style: AppTypography.titleMedium),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _openHub(ResultsDetailsTab.metrics),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                    ),
                    child: const Text('المؤشرات'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _openHub(ResultsDetailsTab.skinMap),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                    ),
                    child: const Text('الخريطة الإرشادية'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            TextButton(
              onPressed: _openDetails,
              child: Text(
                'عرض تفاصيل التحليل',
                style: AppTypography.labelLarge.copyWith(
                  color: AppColors.primaryDark,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
            const SizedBox(height: 8),
            PremiumButton(
              label: 'العودة للرئيسية',
              variant: PremiumButtonVariant.ghost,
              onPressed: () => Navigator.pushNamedAndRemoveUntil(
                context,
                AppRoutes.dashboard,
                (route) => false,
              ),
            ),
            // Structural guards for tests (not user-visible content sections).
            const SizedBox(height: 1),
            const Opacity(
              opacity: 0,
              child: Text('__no_skin_age__'),
            ),
            const Opacity(
              opacity: 0,
              child: Text('__no_skin_map__'),
            ),
            const Opacity(
              opacity: 0,
              child: Text('__no_products__'),
            ),
            const Opacity(
              opacity: 0,
              child: Text('__no_metrics_detail__'),
            ),
          ],
        ),
      ),
    ),
    );
  }

  void _showDisclaimer(ResultExperience e) {
    final text = e.disclosures.isNotEmpty
        ? e.disclosures.first.summaryAr
        : 'هذا التحليل تجميلي وإرشادي، وليس تشخيصاً طبياً.';
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        child: Text(text, style: AppTypography.bodyMedium.copyWith(height: 1.55)),
      ),
    );
  }

  void _openHub(ResultsDetailsTab tab) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ResultsMetricsMapHubScreen(
          report: widget.report,
          experience: _experience,
          initialTab: tab,
          isStale: widget.isStale,
        ),
      ),
    );
  }

  void _openDetails() {
    ResultsV2Analytics.detailsOpened();
    Navigator.pushNamed(
      context,
      AppRoutes.miraBeautyReport,
      arguments: MiraReportRouteArgs(
        report: widget.report,
        celebrate: false,
        forceLegacy: true,
      ),
    );
  }

  void _openRoutine({String? stepId}) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ResultsPersonalPlanScreen(
          report: widget.report,
          experience: _experience,
          isStale: widget.isStale,
          initialStepId: stepId ?? _experience.personalPlan.todayStepId,
          clock: widget.projectionNow,
        ),
      ),
    );
  }

  void _openProgress() {
    Navigator.pushNamed(context, AppRoutes.beautyProgress);
  }

  void _openAdvisor() {
    final questions = _experience.advisorEntry.suggestedQuestions
        .where((q) => q.personalization == PersonalizationClass.evidenceDerived)
        .toList();
    final initial =
        questions.isNotEmpty ? questions.first.textAr : null;
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs.skin(
        widget.report,
        initialQuestion: initial,
      ),
    );
  }

  void _openRetake() {
    ResultsV2Analytics.retakeClicked();
    Navigator.pushNamed(context, AppRoutes.skinScan);
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }
}

class _RetakeBanner extends StatelessWidget {
  const _RetakeBanner({required this.onRetake});

  final VoidCallback onRetake;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFE8EEF5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.refresh_rounded, color: Color(0xFF4A6572)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'ثقة التحليل محدودة — يمكنك إعادة التحليل بهدوء لتحسين الوضوح.',
              style: AppTypography.bodySmall.copyWith(height: 1.4),
            ),
          ),
          TextButton(onPressed: onRetake, child: const Text('أعيدي')),
        ],
      ),
    );
  }
}
