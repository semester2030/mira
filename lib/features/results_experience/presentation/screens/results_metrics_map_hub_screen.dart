import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../contracts/result_presentation_vms.dart';
import '../analytics/results_v2_analytics.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../widgets/metric_detail_sheet.dart';
import '../widgets/metrics_overview_section.dart';
import '../widgets/results_skin_map_panel.dart';
import 'results_personal_plan_screen.dart';

enum ResultsDetailsTab { metrics, skinMap }

/// Phase 8D hub — Metrics + Interactive illustrative Skin Map only.
class ResultsMetricsMapHubScreen extends StatefulWidget {
  const ResultsMetricsMapHubScreen({
    super.key,
    required this.report,
    required this.experience,
    this.initialTab = ResultsDetailsTab.metrics,
    this.isStale = false,
    this.missingImage = false,
  });

  final SkinReport report;
  final ResultExperience experience;
  final ResultsDetailsTab initialTab;
  final bool isStale;
  final bool missingImage;

  @override
  State<ResultsMetricsMapHubScreen> createState() =>
      _ResultsMetricsMapHubScreenState();
}

class _ResultsMetricsMapHubScreenState extends State<ResultsMetricsMapHubScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  var _loggedMetrics = false;
  var _loggedMap = false;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTab == ResultsDetailsTab.skinMap ? 1 : 0,
    );
    _tabs.addListener(_onTab);
    WidgetsBinding.instance.addPostFrameCallback((_) => _logForIndex(_tabs.index));
  }

  void _onTab() {
    if (_tabs.indexIsChanging) return;
    _logForIndex(_tabs.index);
  }

  void _logForIndex(int index) {
    if (index == 0 && !_loggedMetrics) {
      _loggedMetrics = true;
      ResultsV2Analytics.metricsViewed();
    }
    if (index == 1 && !_loggedMap) {
      _loggedMap = true;
      ResultsV2Analytics.skinMapViewed();
    }
  }

  @override
  void dispose() {
    _tabs.removeListener(_onTab);
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.experience;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const MiraAppBar(),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  'تفاصيل النتيجة',
                  style: AppTypography.titleMedium,
                ),
              ),
            ),
            TabBar(
              controller: _tabs,
              labelColor: AppColors.primaryDark,
              unselectedLabelColor: AppColors.textSecondary,
              indicatorColor: AppColors.gold,
              tabs: const [
                Tab(text: 'المؤشرات'),
                Tab(text: 'الخريطة الإرشادية'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: [
                  ListView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                    children: [
                      MetricsOverviewSection(
                        metrics: e.metrics,
                        onOpen: (m) {
                          ResultsV2Analytics.metricOpened(metricId: m.id);
                          if (!m.evidenceAvailable) {
                            ResultsV2Analytics.metricUnavailable(metricId: m.id);
                          }
                          showMetricDetailSheet(
                            context: context,
                            metric: m,
                            onAskMira: () => _askMiraForMetric(m),
                            onOpenRoutine: () => _openPlanForMetric(m),
                            onRetake: () => Navigator.pushNamed(
                              context,
                              AppRoutes.skinScan,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  ListView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                    children: [
                      ResultsSkinMapPanel(
                        map: e.map,
                        metrics: e.metrics,
                        isStale: widget.isStale,
                        missingImage: widget.missingImage,
                        onInfoOpened: ResultsV2Analytics.skinMapInfoOpened,
                        onConcernSelected: (id) =>
                            ResultsV2Analytics.skinMapConcernSelected(
                          concernId: id,
                        ),
                        onUnavailable: ResultsV2Analytics.skinMapUnavailable,
                        onAskMira: _askMiraForConcern,
                        onOpenRoutine: _openPlan,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _askMiraForMetric(ResultMetricVM m) {
    ResultsV2Analytics.metricAdvisorOpened(metricId: m.id);
    final q = 'اشرحي لي مؤشر ${m.titleAr} في نتيجتي';
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs.skin(widget.report, initialQuestion: q),
    );
  }

  void _openPlan({String? stepId}) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ResultsPersonalPlanScreen(
          report: widget.report,
          experience: widget.experience,
          isStale: widget.isStale,
          initialStepId: stepId ?? widget.experience.personalPlan.todayStepId,
        ),
      ),
    );
  }

  void _openPlanForMetric(ResultMetricVM m) {
    final concept = MetricPresentationPolicy.adviceConceptId(m);
    final steps = [
      ...widget.experience.personalPlan.morning.steps,
      ...widget.experience.personalPlan.evening.steps,
    ];
    final match = steps.where((s) => s.adviceConceptId == concept);
    _openPlan(stepId: match.isNotEmpty ? match.first.id : null);
  }

  void _askMiraForConcern(String concernId) {
    ResultsV2Analytics.skinMapAdvisorOpened(concernId: concernId);
    final label = MetricPresentationPolicy.publicLabelAr(concernId);
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs.skin(
        widget.report,
        initialQuestion: 'اشرحي لي نتيجة $label المعروضة إرشادياً',
      ),
    );
  }
}
