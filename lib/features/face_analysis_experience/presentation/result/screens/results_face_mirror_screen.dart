import 'package:flutter/material.dart';

import '../../../../../core/navigation/app_routes.dart';
import '../../../../../core/navigation/route_args.dart';
import '../../../../../core/session/analysis_session.dart';
import '../../../../../shared/theme/typography.dart';
import '../../../../../shared/widgets/mira_app_bar.dart';
import '../../../../intelligence/domain/entities/face_intelligence_report.dart';
import '../../../../intelligence/presentation/widgets/mira_report_helpers.dart';
import '../../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../advisor_context/advisor_context.dart';
import '../../../guidance/guidance.dart';
import '../../../history/history.dart';
import '../../../projection/contracts/face_result_enums.dart';
import '../../../projection/contracts/face_result_vms.dart';
import '../../../projection/localization/face_result_copy.dart';
import '../../../projection/projector/face_result_projector.dart';
import '../../shared/face_experience_motion.dart';
import '../../shared/face_experience_tokens.dart';
import '../contracts/face_result_selection_state.dart';
import '../coordination/face_result_reveal_coordinator.dart';
import '../details/face_details.dart';
import '../policy/face_result_motion_policy.dart';
import '../session/face_result_mirror_image_hold.dart';
import '../surfaces/face_result_mirror_surface.dart';
import '../tokens/face_result_tokens.dart';
import '../widgets/face_insight_rail.dart';
import '../widgets/face_primary_result_reveal.dart';
import '../widgets/face_result_action_bar.dart';
import '../widgets/face_result_advisor_entry.dart';
import '../widgets/face_result_context_panel.dart';

/// Phase 9F/9G/9H — Result Mirror + Detail Sheets + Personal Guidance.
///
/// Consumes 9E [FaceResultProjection] + frozen Face recommendations only.
/// No Face Intelligence recomputation / no new recommendation engine.
class ResultsFaceMirrorScreen extends StatefulWidget {
  const ResultsFaceMirrorScreen({
    super.key,
    required this.report,
    this.captureImagePath,
    this.showCelebration = true,
    this.projection,
    this.recommendations,
    FaceSubjectOrientation? orientation,
  }) : orientation = orientation ??
            (captureImagePath != null
                ? FaceSubjectOrientation.mirroredPreview
                : FaceSubjectOrientation.subjectCanonical);

  final SkinReport report;
  final String? captureImagePath;
  final bool showCelebration;
  final FaceResultProjection? projection;
  /// Injected for tests; otherwise taken from frozen Face Intelligence output.
  final List<FaceIntelRecommendation>? recommendations;
  /// Fresh capture continuity uses mirroredPreview; historical uses subjectCanonical.
  final FaceSubjectOrientation orientation;

  @override
  State<ResultsFaceMirrorScreen> createState() =>
      _ResultsFaceMirrorScreenState();
}

class _ResultsFaceMirrorScreenState extends State<ResultsFaceMirrorScreen>
    with SingleTickerProviderStateMixin {
  late final FaceResultProjection _projection;
  late final List<FaceIntelRecommendation> _recommendations;
  late FaceResultRevealCoordinator _reveal;
  late final AnimationController _clock;
  FaceResultSelectionState _selection = FaceResultSelectionState.empty;
  var _releasedHold = false;
  var _started = false;
  var _sheetOpen = false;

  static const _assembler = FaceGuidanceAssembler();

  @override
  void initState() {
    super.initState();
    AnalysisSession.setSkin(widget.report);

    final mira = resolveMiraReport(widget.report);
    _projection = widget.projection ??
        const FaceResultProjector().project(
          mira.faceIntelligence,
          context: FaceResultProjectionContext(
            imageRef: widget.captureImagePath,
            orientation: widget.orientation,
          ),
        );
    _recommendations = widget.recommendations ??
        mira.faceIntelligence?.recommendations ??
        const [];

    _reveal = FaceResultRevealCoordinator(
      policy: FaceResultMotionPolicy.defaults,
    );

    _clock = AnimationController(
      vsync: this,
      duration: FaceResultMotionPolicy.defaults.totalBudget +
          const Duration(milliseconds: 50),
    )..addListener(_onTick);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _started) return;
      _started = true;
      // After analysis motion: shorter reveal — user already waited (9K).
      final policy = FaceExperienceMotion.resultRevealPolicy(
        context: context,
        afterAnalysisMotion: widget.captureImagePath != null,
      );
      setState(() {
        _reveal = FaceResultRevealCoordinator(policy: policy);
      });
      _clock.duration = policy.totalBudget + const Duration(milliseconds: 50);
      _clock.forward(from: 0);
    });
  }

  FaceGuidanceSurfaceVm get _guidanceSurface => _assembler.build(
        projection: _projection,
        recommendations: _recommendations,
        selectedInsightId: _selection.selectedInsightId,
        selectedDetailRefId: _selection.selectedDetailRefId,
      );

  void _onTick() {
    final ms = _clock.duration?.inMilliseconds ?? 1;
    final elapsed = Duration(milliseconds: (_clock.value * ms).round());
    final insights = _projection.executiveSummary.insights.length;
    final prevPhase = _reveal.phase;
    final prevCount = _reveal.insightVisibleCount;
    _reveal.tick(elapsed, insightTotal: insights);
    if (_reveal.phase == prevPhase &&
        _reveal.insightVisibleCount == prevCount) {
      return;
    }
    setState(() {});
  }

  @override
  void dispose() {
    _clock.dispose();
    _releaseHold();
    super.dispose();
  }

  Future<void> _releaseHold() async {
    if (_releasedHold) return;
    _releasedHold = true;
    await FaceResultMirrorImageHold.release(widget.captureImagePath);
  }

  FaceInsightVm? get _selectedInsight {
    final id = _selection.selectedInsightId;
    if (id == null) return null;
    for (final i in _projection.executiveSummary.insights) {
      if (i.id == id) return i;
    }
    return null;
  }

  void _applySelectionFromVm(FaceDetailSheetVm vm) {
    setState(() {
      _selection = _selection.selectDetail(
        detailRefId: vm.detailId,
        insightId: vm.selectedInsightId,
        region: vm.region,
      );
    });
  }

  String? _relatedGuidanceLabelFor(FaceDetailSheetVm vm) {
    final related = _assembler.relatedToDetail(
      surface: _guidanceSurface,
      detailRefId: vm.detailId,
    );
    if (related.isEmpty) return null;
    return 'إرشاد مرتبط: ${related.first.titleAr}';
  }

  Future<void> _openSheet(FaceDetailSheetVm vm) async {
    if (!mounted || _sheetOpen) return;
    _applySelectionFromVm(vm);
    _sheetOpen = true;
    final relatedLabel = _relatedGuidanceLabelFor(vm);
    await showFaceDetailSheet(
      context: context,
      vm: vm,
      relatedGuidanceLabel: relatedLabel,
      onOpenRelatedGuidance: relatedLabel == null ? null : _openGuidance,
      onPrimaryAction: _onDetailPrimary,
      onRelatedTap: (detailRefId) {
        final next = FaceDetailRouter.resolveDetailRef(
          _projection,
          detailRefId,
        );
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _openSheet(next);
        });
      },
    );
    if (mounted) {
      setState(() => _sheetOpen = false);
    } else {
      _sheetOpen = false;
    }
  }

  void _requestRetake(FaceRetakeReason reason, FaceRetakeSource source) {
    FaceHistoryAnalytics.retakeStarted(source.name);
    FaceRetakePolicy.build(
      reason: reason,
      source: source,
      currentAnalysisRef: _projection.mirror.analysisId,
    );
    Navigator.of(context).pop(FaceRetakePolicy.popResult);
  }

  Future<void> _openHistory() async {
    final result = await openFaceHistory(
      context: context,
      currentReport: widget.report,
    );
    if (!mounted) return;
    if (result == FaceRetakePolicy.popResult) {
      // History already logged retake_started — propagate canonical pop token.
      Navigator.of(context).pop(FaceRetakePolicy.popResult);
    }
  }

  void _onDetailPrimary(FaceDetailPrimaryActionKind kind) {
    switch (kind) {
      case FaceDetailPrimaryActionKind.close:
        break;
      case FaceDetailPrimaryActionKind.retake:
        _requestRetake(
          FaceRetakeReason.retakeRecommended,
          FaceRetakeSource.detailSheet,
        );
        break;
      case FaceDetailPrimaryActionKind.askMira:
        final detailId = _selection.selectedDetailRefId;
        final detail = detailId == null
            ? null
            : FaceDetailRouter.resolveDetailRef(_projection, detailId);
        _openAskMira(detail: detail);
        break;
      case FaceDetailPrimaryActionKind.exploreRelated:
        break;
    }
  }

  void _selectInsight(FaceInsightVm insight, {bool openSheet = true}) {
    FaceDetailAnalytics.insightSelected(insight.id);
    setState(() {
      _selection = _selection.selectInsight(
        insightId: insight.id,
        region: insight.relatedRegion,
        detailRefId: insight.detailRef.id,
      );
    });
    if (openSheet) {
      _openSheet(FaceDetailRouter.resolveInsight(_projection, insight));
    }
  }

  void _selectRegion(FacePresentationRegion region) {
    FaceDetailAnalytics.regionSelected(region.name);
    final vm = FaceDetailRouter.resolveRegion(_projection, region);
    setState(() {
      _selection = _selection.selectRegion(
        region,
        insightId: vm.selectedInsightId,
        detailRefId: vm.detailId,
      );
    });
    _openSheet(vm);
  }

  void _openPrimaryDetail() {
    final primary = _projection.executiveSummary.primary;
    if (primary == null) return;
    final vm = FaceDetailRouter.resolvePrimary(_projection);
    _openSheet(vm);
  }

  void _openDetailsButton() {
    final vm = FaceDetailRouter.resolveDetailsButton(
      _projection,
      selectedInsightId: _selection.selectedInsightId,
    );
    _openSheet(vm);
  }

  void _openFullReport() {
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

  Future<void> _openGuidance() async {
    if (!mounted || _sheetOpen) return;
    _sheetOpen = true;
    final surface = _guidanceSurface;
    await showFaceGuidanceSheet(
      context: context,
      surface: surface,
      onAction: _onGuidanceAction,
    );
    if (mounted) {
      setState(() => _sheetOpen = false);
    } else {
      _sheetOpen = false;
    }
  }

  void _onGuidanceAction(FaceGuidanceItemVm item) {
    switch (item.primaryAction) {
      case FaceGuidanceActionKind.retake:
        _requestRetake(
          FaceRetakeReason.retakeRecommended,
          FaceRetakeSource.guidance,
        );
        break;
      case FaceGuidanceActionKind.askMira:
        _openAskMira(guidance: item);
        break;
      case FaceGuidanceActionKind.exploreResult:
        final detailId = item.sourceDetailRef;
        if (detailId != null) {
          _openSheet(
            FaceDetailRouter.resolveDetailRef(_projection, detailId),
          );
        }
        break;
      case FaceGuidanceActionKind.openOwnedFeature:
      case FaceGuidanceActionKind.close:
        break;
    }
  }

  void _openAskMira({
    String? prompt,
    FaceDetailSheetVm? detail,
    FaceGuidanceItemVm? guidance,
  }) {
    final ctx = const FaceAdvisorContextAssembler().build(
      projection: _projection,
      selection: _selection,
      openDetail: detail,
      selectedGuidance: guidance,
      guidanceContext: guidance == null
          ? null
          : FaceGuidanceAdvisorContext.fromItem(
              analysisId: _projection.mirror.analysisId,
              item: guidance,
            ),
      reportRef: widget.report.id,
    );
    FaceAdvisorContextAnalytics.opened(ctx);
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs.face(
        report: widget.report,
        faceContext: ctx,
        initialQuestion: prompt ?? ctx.initialQuestionAr,
      ),
    ).then((_) {
      if (!mounted) return;
      FaceAdvisorContextAnalytics.returned(ctx.contextType);
      // Selection state preserved on this screen — return to same mirror state.
    });
  }

  void _onPrimaryAction() {
    final kind = _projection.executiveSummary.nextAction.kind;
    switch (kind) {
      case FaceNextActionKind.retake:
        _requestRetake(
          FaceRetakeReason.retakeRecommended,
          FaceRetakeSource.resultMirror,
        );
        break;
      case FaceNextActionKind.askMira:
        _openAskMira();
        break;
      case FaceNextActionKind.exploreDetails:
        _openDetailsButton();
        break;
      case FaceNextActionKind.openGuidance:
        _openGuidance();
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = _projection.executiveSummary;
    final mirror = _projection.mirror;
    final isRetake = summary.nextAction.kind == FaceNextActionKind.retake ||
        summary.completeness == FaceResultCompleteness.empty ||
        summary.primary?.eligibility ==
            FacePresentationEligibility.retakeRecommended ||
        summary.primary?.eligibility ==
            FacePresentationEligibility.noUsableResult;

    final imagePath = widget.captureImagePath ?? mirror.imageRef;
    final guidance = _guidanceSurface;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: FaceExperienceTokens.scaffoldDark,
        appBar: const MiraAppBar(pageTitle: 'مرآة النتيجة'),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                flex: 58,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: RepaintBoundary(
                    child: FaceResultMirrorSurface(
                      imagePath: imagePath,
                      orientation: mirror.orientation,
                      contourAllowed: mirror.contourAllowed && !isRetake,
                      contourCalm: _reveal.showContourCalm,
                      interactiveRegionsAllowed:
                          mirror.interactiveRegionsAllowed && !isRetake,
                      regions: _projection.regions,
                      selectedRegion: _selection.selectedRegion,
                      onRegionTap: _selectRegion,
                    ),
                  ),
                ),
              ),
              Expanded(
                flex: 42,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (isRetake) ...[
                        _LimitationBanner(
                          title: summary.headlineAr,
                          body: summary.supportAr.isNotEmpty
                              ? summary.supportAr
                              : FaceResultCopy.emptySupport,
                        ),
                        const SizedBox(height: 12),
                      ] else ...[
                        if (summary.primary != null)
                          FacePrimaryResultReveal(
                            primary: summary.primary!,
                            visible: _reveal.showPrimary,
                            onTap: _openPrimaryDetail,
                          ),
                        if (summary.primary == null &&
                            summary.completeness ==
                                FaceResultCompleteness.partial)
                          _LimitationBanner(
                            title: summary.headlineAr,
                            body: summary.supportAr,
                          ),
                        const SizedBox(height: 12),
                        FaceInsightRail(
                          insights: summary.insights,
                          visibleCount: _reveal.insightVisibleCount,
                          selectedInsightId: _selection.selectedInsightId,
                          onSelect: (i) => _selectInsight(i),
                        ),
                        const SizedBox(height: 10),
                        FaceResultContextPanel(insight: _selectedInsight),
                        if (MediaQuery.accessibleNavigationOf(context)) ...[
                          const SizedBox(height: 12),
                          FaceDetailAccessibilityList(
                            projection: _projection,
                            onOpenPrimary: _openPrimaryDetail,
                            onOpenDetailRef: (id) {
                              _openSheet(
                                FaceDetailRouter.resolveDetailRef(
                                  _projection,
                                  id,
                                ),
                              );
                            },
                          ),
                        ],
                        const SizedBox(height: 12),
                      ],
                      FaceResultActionBar(
                        nextAction: summary.nextAction,
                        visible: _reveal.showActions || isRetake,
                        onPrimary: _onPrimaryAction,
                        onAskMira: _openAskMira,
                        onFullReport: _openFullReport,
                        detailsEnabled: !isRetake,
                        onDetails: _openDetailsButton,
                      ),
                      if (!isRetake) ...[
                        const SizedBox(height: 8),
                        FaceGuidanceEntry(
                          surface: guidance,
                          visible: _reveal.showActions,
                          onTap: _openGuidance,
                        ),
                        const SizedBox(height: 8),
                        FaceResultAdvisorEntry(
                          entry: FaceAdvisorEntryVm(
                            analysisId: summary.advisorEntry.analysisId,
                            selectedInsightId: _selection.selectedInsightId ??
                                summary.advisorEntry.selectedInsightId,
                            evidenceRefs: summary.advisorEntry.evidenceRefs,
                            suggestedQuestionKeys:
                                summary.advisorEntry.suggestedQuestionKeys,
                          ),
                          visible: _reveal.showActions,
                          onTap: _openAskMira,
                        ),
                        FaceHistoryEntryChip(
                          visible: _reveal.showActions,
                          onTap: _openHistory,
                        ),
                      ],
                      if (isRetake) ...[
                        const SizedBox(height: 8),
                        FaceHistoryEntryChip(
                          visible: true,
                          onTap: _openHistory,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LimitationBanner extends StatelessWidget {
  const _LimitationBanner({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FaceResultTokens.glass,
        borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
        border: Border.all(color: FaceResultTokens.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTypography.titleSmall.copyWith(
              color: FaceResultTokens.onGlass,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.qualifier,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
