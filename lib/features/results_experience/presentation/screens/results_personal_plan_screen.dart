import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../localization/personalization_labels.dart';
import '../../persistence/routine_completion_store.dart';
import '../analytics/results_v2_analytics.dart';
import '../widgets/results_confidence_chip.dart';

/// Phase 8E — Personal Plan + Daily Routine (no products / progress).
class ResultsPersonalPlanScreen extends StatefulWidget {
  const ResultsPersonalPlanScreen({
    super.key,
    required this.report,
    required this.experience,
    this.isStale = false,
    this.initialStepId,
    this.clock,
    this.userId,
    this.completionStore,
  });

  final SkinReport report;
  final ResultExperience experience;
  final bool isStale;
  final String? initialStepId;
  /// Explicit clock for deterministic period/completion day.
  final DateTime? clock;
  final String? userId;
  final RoutineCompletionStore? completionStore;

  @override
  State<ResultsPersonalPlanScreen> createState() =>
      _ResultsPersonalPlanScreenState();
}

class _ResultsPersonalPlanScreenState extends State<ResultsPersonalPlanScreen> {
  late RoutinePeriod _period;
  late RoutineCompletionStore _store;
  late DateTime _day;
  final Map<String, bool> _done = {};
  var _loading = true;
  String? _highlightStepId;

  ResultPersonalPlanVM get _plan => widget.experience.personalPlan;

  @override
  void initState() {
    super.initState();
    _day = widget.clock ?? DateTime.now();
    final uid = widget.userId ?? widget.report.id ?? 'local_user';
    _store = widget.completionStore ??
        RoutineCompletionStore(
          userId: uid.isEmpty ? 'local_user' : uid,
          analysisId: widget.experience.id,
        );
    _period = _initialPeriod();
    _highlightStepId = widget.initialStepId ?? _plan.todayStepId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ResultsV2Analytics.routineViewed();
      if (!_plan.eligible) ResultsV2Analytics.routineUnavailable();
      if (_plan.weekly != null) ResultsV2Analytics.weeklyAdjustmentViewed();
      if (_plan.avoidances.isNotEmpty) ResultsV2Analytics.avoidanceViewed();
      _loadCompletion();
    });
  }

  RoutinePeriod _initialPeriod() {
    final id = widget.initialStepId ?? _plan.todayStepId;
    if (id != null) {
      for (final s in _plan.evening.steps) {
        if (s.id == id) return RoutinePeriod.evening;
      }
    }
    final hour = _day.hour;
    if (hour >= 17) return RoutinePeriod.evening;
    return RoutinePeriod.morning;
  }

  Future<void> _loadCompletion() async {
    final ids = [
      ..._plan.morning.steps.map((s) => s.id),
      ..._plan.evening.steps.map((s) => s.id),
    ];
    final map = await _store.loadForSteps(ids, _day);
    if (!mounted) return;
    setState(() {
      _done
        ..clear()
        ..addAll(map);
      _loading = false;
    });
  }

  List<ResultRoutineStepVM> get _steps =>
      _period == RoutinePeriod.evening ? _plan.evening.steps : _plan.morning.steps;

  Future<void> _toggle(ResultRoutineStepVM step) async {
    if (!step.completionEligible) return;
    final next = !(_done[step.id] ?? false);
    await _store.setComplete(step.id, _day, complete: next);
    if (!mounted) return;
    setState(() => _done[step.id] = next);
    if (next) {
      ResultsV2Analytics.routineStepCompleted(stepId: step.id);
    } else {
      ResultsV2Analytics.routineStepUncompleted(stepId: step.id);
    }
  }

  void _setPeriod(RoutinePeriod p) {
    setState(() => _period = p);
    ResultsV2Analytics.routinePeriodChanged(
      period: p == RoutinePeriod.evening ? 'evening' : 'morning',
    );
  }

  void _openAdvisor([String? question]) {
    ResultsV2Analytics.routineAdvisorOpened();
    final qs = _plan.advisorEntry.suggestedQuestions
        .where((q) => q.personalization != PersonalizationClass.unsupported)
        .toList();
    final initial = question ??
        (qs.isNotEmpty ? qs.first.textAr : null);
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs.skin(
        widget.report,
        initialQuestion: initial,
      ),
    );
  }

  void _retake() {
    ResultsV2Analytics.routineRetakeClicked();
    Navigator.pushNamed(context, AppRoutes.skinScan);
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const MiraAppBar(),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                children: [
                  Text(plan.titleAr, style: AppTypography.titleLarge),
                  const SizedBox(height: 8),
                  _PlanSummary(plan: plan, isStale: widget.isStale),
                  if (!plan.eligible) ...[
                    const SizedBox(height: 16),
                    Text(
                      plan.summaryAr,
                      style: AppTypography.bodyMedium.copyWith(height: 1.5),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: _retake,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                      ),
                      child: const Text('إعادة التحليل'),
                    ),
                  ] else ...[
                    const SizedBox(height: 16),
                    SegmentedButton<RoutinePeriod>(
                      segments: const [
                        ButtonSegment(
                          value: RoutinePeriod.morning,
                          label: Text('الصباح'),
                          icon: Icon(Icons.wb_sunny_outlined),
                        ),
                        ButtonSegment(
                          value: RoutinePeriod.evening,
                          label: Text('المساء'),
                          icon: Icon(Icons.nights_stay_outlined),
                        ),
                      ],
                      selected: {_period},
                      onSelectionChanged: (s) => _setPeriod(s.first),
                    ),
                    const SizedBox(height: 14),
                    if (_steps.isEmpty)
                      Text(
                        _period == RoutinePeriod.morning
                            ? 'لا توجد خطوات صباحية مؤهلة في هذه الخطة.'
                            : 'لا توجد خطوات مسائية مؤهلة في هذه الخطة.',
                        style: AppTypography.bodyMedium,
                      )
                    else
                      ..._steps.map(
                        (s) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _StepCard(
                            step: s,
                            completed: _done[s.id] ?? false,
                            highlighted: s.id == _highlightStepId,
                            onToggle: () => _toggle(s),
                            onOpen: () {
                              ResultsV2Analytics.routineStepOpened(
                                stepId: s.id,
                              );
                              _showStepSheet(s);
                            },
                          ),
                        ),
                      ),
                    if (plan.weekly != null) ...[
                      const SizedBox(height: 8),
                      _WeeklyCard(weekly: plan.weekly!),
                    ],
                    if (plan.avoidances.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text('ما يجب تجنبه', style: AppTypography.titleMedium),
                      const SizedBox(height: 8),
                      ...plan.avoidances.map(
                        (a) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _AvoidCard(item: a),
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: () => _openAdvisor(),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                      ),
                      child: const Text('اسألي مستشار ميرا عن روتينك'),
                    ),
                    if (plan.isLimited || widget.experience.retake.suggested) ...[
                      const SizedBox(height: 10),
                      TextButton(
                        onPressed: _retake,
                        child: const Text('إعادة التحليل'),
                      ),
                    ],
                  ],
                  // Structural guards — no products/progress on this surface.
                  const Opacity(opacity: 0, child: Text('__no_products__')),
                  const Opacity(opacity: 0, child: Text('__no_progress__')),
                ],
              ),
      ),
    );
  }

  void _showStepSheet(ResultRoutineStepVM step) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(step.titleAr, style: AppTypography.titleMedium),
            const SizedBox(height: 6),
            Text(
              '${step.sequence}. ${step.instructionAr}',
              style: AppTypography.bodyMedium.copyWith(height: 1.45),
            ),
            const SizedBox(height: 8),
            Text(
              'لماذا أُضيفت: ${step.reasonAr}',
              style: AppTypography.bodySmall.copyWith(height: 1.4),
            ),
            const SizedBox(height: 6),
            Text(
              PersonalizationLabels.ar(step.personalization),
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.primaryDark,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            ResultsConfidenceChip(state: step.confidence, compact: true),
            if (step.advisorEligible) ...[
              const SizedBox(height: 14),
              OutlinedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  _openAdvisor('لماذا أضفتِ هذه الخطوة إلى روتيني؟');
                },
                child: const Text('اسألي مستشار ميرا عن هذه الخطوة'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PlanSummary extends StatelessWidget {
  const _PlanSummary({required this.plan, required this.isStale});
  final ResultPersonalPlanVM plan;
  final bool isStale;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'التركيز: ${plan.focusAr}',
            style: AppTypography.titleSmall,
          ),
          const SizedBox(height: 6),
          Text(
            plan.primaryObjectiveAr,
            style: AppTypography.bodySmall.copyWith(height: 1.4),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ResultsConfidenceChip(state: plan.confidence, compact: true),
              _MetaChip('${plan.activeStepCount} خطوات'),
              if (plan.isLimited) const _MetaChip('خطة محدودة'),
              if (isStale) const _MetaChip('نتيجة سابقة'),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            plan.reviewGuidanceAr,
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFE8EEF5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _StepCard extends StatelessWidget {
  const _StepCard({
    required this.step,
    required this.completed,
    required this.highlighted,
    required this.onToggle,
    required this.onOpen,
  });

  final ResultRoutineStepVM step;
  final bool completed;
  final bool highlighted;
  final VoidCallback onToggle;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final pers = PersonalizationLabels.ar(step.personalization);
    return Material(
      color: highlighted
          ? AppColors.goldLight.withValues(alpha: 0.35)
          : AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: highlighted
                  ? AppColors.gold.withValues(alpha: 0.5)
                  : AppColors.border.withValues(alpha: 0.45),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                label: completed
                    ? 'الخطوة ${step.sequence} مكتملة'
                    : 'الخطوة ${step.sequence} غير مكتملة',
                button: true,
                child: IconButton(
                  onPressed: step.completionEligible ? onToggle : null,
                  icon: Icon(
                    completed
                        ? Icons.check_circle_rounded
                        : Icons.circle_outlined,
                    color: completed
                        ? AppColors.primaryDark
                        : AppColors.textSecondary,
                  ),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      '${step.sequence}. ${step.titleAr}',
                      style: AppTypography.titleSmall.copyWith(
                        decoration:
                            completed ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      step.instructionAr,
                      style: AppTypography.bodySmall.copyWith(height: 1.4),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (pers.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        pers,
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.primaryDark,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WeeklyCard extends StatelessWidget {
  const _WeeklyCard({required this.weekly});
  final ResultWeeklyAdjustmentVM weekly;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('تعديل الأسبوع', style: AppTypography.titleMedium),
          const SizedBox(height: 6),
          Text(weekly.titleAr, style: AppTypography.titleSmall),
          const SizedBox(height: 4),
          Text(
            weekly.instructionAr,
            style: AppTypography.bodySmall.copyWith(height: 1.4),
          ),
          const SizedBox(height: 6),
          Text(
            '${weekly.frequencyAr} · ${weekly.successSignalAr}',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            PersonalizationLabels.ar(weekly.personalization),
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.primaryDark,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _AvoidCard extends StatelessWidget {
  const _AvoidCard({required this.item});
  final ResultAvoidanceVM item;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F1EA),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(item.titleAr, style: AppTypography.titleSmall),
          const SizedBox(height: 4),
          Text(
            item.summaryAr,
            style: AppTypography.bodySmall.copyWith(height: 1.4),
          ),
          const SizedBox(height: 4),
          Text(
            PersonalizationLabels.ar(item.personalization),
            style: AppTypography.labelSmall,
          ),
        ],
      ),
    );
  }
}
