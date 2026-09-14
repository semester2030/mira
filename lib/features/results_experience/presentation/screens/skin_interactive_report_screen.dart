import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../advisor/domain/services/local_advisor_engine.dart';
import '../../../face_analysis_experience/presentation/result/session/face_result_mirror_image_hold.dart';
import '../../../intelligence/presentation/widgets/mira_report_helpers.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../domain/perfect_mask_session.dart';
import '../../localization/public_language_policy.dart';
import '../../projection/mira_beauty_report_projection_adapter.dart';
import '../../projection/result_experience_projector.dart';
import '../../projection/result_projection_input.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../../truth/skin_claim_policy.dart';
import '../../truth/skin_truth_class.dart';
import '../icons/mira_skin_glyphs.dart';
import '../widgets/executive_summary_hero.dart';
import '../widgets/priority_cards_section.dart';
import '../widgets/results_confidence_chip.dart';
import '../widgets/results_skin_map_panel.dart';
import 'results_personal_plan_screen.dart';

/// Face-first interactive Skin Report — ephemeral user image for current only.
class SkinInteractiveReportScreen extends StatefulWidget {
  const SkinInteractiveReportScreen({
    super.key,
    required this.report,
    this.showCelebration = true,
    this.isStale = false,
    this.captureImagePath,
    this.experience,
    this.projectionNow,
    this.fromHistory = false,
    this.perfectMaskSession,
  });

  final SkinReport report;
  final bool showCelebration;
  final bool isStale;
  final String? captureImagePath;
  final ResultExperience? experience;
  final DateTime? projectionNow;
  final bool fromHistory;
  /// Bound Perfect mask session for this result route (same analysis).
  final PerfectMaskSession? perfectMaskSession;

  @override
  State<SkinInteractiveReportScreen> createState() =>
      _SkinInteractiveReportScreenState();
}

class _SkinInteractiveReportScreenState
    extends State<SkinInteractiveReportScreen> {
  late final ResultExperience _experience;
  late final ScrollController _scroll;
  final _mapSectionKey = GlobalKey();
  final _mapPanelKey = GlobalKey<ResultsSkinMapPanelState>();
  String? _focusedConcernId;
  var _transparencyOpen = false;
  var _releasedHold = false;
  /// Stable for this screen lifetime — do not re-read cleared static on rebuild.
  PerfectMaskSession? _boundMaskSession;

  @override
  void initState() {
    super.initState();
    _scroll = ScrollController();
    AnalysisSession.setSkin(widget.report);
    _experience = widget.experience ?? _project();
    // Face Explorer opens on ORIGINAL — user chooses one concern.
    _focusedConcernId = null;
    if (!widget.fromHistory) {
      _boundMaskSession =
          widget.perfectMaskSession ?? AnalysisSession.lastPerfectMasks;
      // Keep canonical owner aligned with the bound session for this result.
      if (_boundMaskSession != null &&
          !identical(AnalysisSession.lastPerfectMasks, _boundMaskSession)) {
        AnalysisSession.setPerfectMasks(_boundMaskSession);
      }
      assert(() {
        final s = _boundMaskSession;
        debugPrint(
          'MASK_SESSION_BIND '
          'held=${s != null} '
          'present=${s?.providersPresent().length ?? 0} '
          'withBytes=${s?.providersWithMaskBytes().length ?? 0} '
          'hasAny=${s?.hasAnyMask == true}',
        );
        return true;
      }());
    }

    if (widget.showCelebration && !widget.fromHistory) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        AnalysisCelebration.show(
          context,
          message: AnalysisCelebration.messageForSkin(),
        );
      });
    }
  }

  @override
  void dispose() {
    _releaseEphemeralFace();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _releaseEphemeralFace() async {
    if (_releasedHold) return;
    _releasedHold = true;
    if (!widget.fromHistory) {
      await FaceResultMirrorImageHold.release(widget.captureImagePath);
      // Detach owner only — do not dispose bytes (stacked result routes may hold).
      AnalysisSession.detachPerfectMasksIfCurrent(_boundMaskSession);
      _boundMaskSession = null;
    }
  }

  ResultExperience _project() {
    final mira = resolveMiraReport(widget.report);
    final input = MiraBeautyReportProjectionAdapter.fromReport(mira);
    return const ResultExperienceProjector().project(
      input,
      ResultProjectionContext(
        now: widget.projectionNow ?? DateTime.now().toUtc(),
        flagVariant: 'skin_interactive_v1',
      ),
    );
  }

  List<ResultMetricVM> get _visibleMetrics => _experience.metrics
      .where((m) =>
          m.visibility == VisibilityState.visiblePrimary ||
          m.visibility == VisibilityState.visibleSecondary)
      .where((m) => m.evidenceAvailable)
      .toList();

  @override
  Widget build(BuildContext context) {
    final e = _experience;
    final hasUserImage = !widget.fromHistory &&
        widget.captureImagePath != null &&
        widget.captureImagePath!.isNotEmpty;
    final missingImage = !widget.fromHistory && !hasUserImage;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const MiraAppBar(pageTitle: 'بشرتك'),
      body: SafeArea(
        child: ListView(
          controller: _scroll,
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          children: [
            ExecutiveSummaryHero(
              summary: e.summary,
              confidence: e.confidence,
              isStale: widget.isStale,
              isPartial: _visibleMetrics.isEmpty,
              onDisclaimer: () => _showCosmeticDisclaimer(e),
            ),
            const SizedBox(height: 10),
            ResultsSkinMapPanel(
              key: _mapPanelKey,
              mapKey: _mapSectionKey,
              map: e.map,
              metrics: e.metrics,
              isStale: widget.isStale,
              missingImage: missingImage,
              fromHistory: widget.fromHistory,
              ephemeralUserImagePath:
                  widget.fromHistory ? null : widget.captureImagePath,
              externalConcernId: _focusedConcernId,
              maskSession:
                  widget.fromHistory ? null : _boundMaskSession,
              onAskMira: (q) => _openAdvisor(initialQuestion: q),
              onInfoOpened: () {},
              onConcernSelected: (id) => setState(() => _focusedConcernId = id),
              onUnavailable: () {},
              onOpenRoutine: () => _openRoutine(),
            ),
            if (!widget.fromHistory &&
                widget.captureImagePath != null &&
                _boundMaskSession?.hasAnyMask == true) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).pushNamed(
                    AppRoutes.applePortraitMattingPoc,
                    arguments: widget.captureImagePath,
                  );
                },
                icon: const Icon(Icons.cut_outlined, size: 18),
                label: const Text('POC Apple Matte (داخلي)'),
              ),
            ],
            const SizedBox(height: 28),
            Divider(
              height: 1,
              color: AppColors.border.withValues(alpha: 0.28),
            ),
            const SizedBox(height: 20),
            Text(
              'ملخص التحليل',
              style: AppTypography.labelMedium.copyWith(
                color: AppColors.textTertiary,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(height: 10),
            _TruthBadgeRow(
              vitality: SkinClaimPolicy.vitalityTruthClass(),
              map: SkinClaimPolicy.mapTruthClass,
            ),
            const SizedBox(height: 16),
            Text(
              'أهم الملاحظات',
              style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            PriorityCardsSection(
              priorities: e.priorities.take(3).toList(),
              onOpen: (p) => _focusInsightOnMap(p),
            ),
            const SizedBox(height: 16),
            _RoutinePreview(
              plan: e.personalPlan,
              onOpen: _openRoutine,
            ),
            const SizedBox(height: 14),
            _SkinJourneyCard(progress: e.progressPreview),
            const SizedBox(height: 14),
            _AskMiraSkinBlock(
              questions: e.advisorEntry.suggestedQuestions.take(4).toList(),
              focusedMetricId: _focusedConcernId,
              onOpen: _openAdvisor,
            ),
            const SizedBox(height: 10),
            Theme(
              data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                initiallyExpanded: _transparencyOpen,
                onExpansionChanged: (v) => setState(() => _transparencyOpen = v),
                tilePadding: EdgeInsets.zero,
                title: Text(
                  'كيف توصلت ميرا لهذه النتيجة؟',
                  style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
                ),
                children: [
                  _TransparencyPanel(experience: e),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'نتيجة تجميلية استشارية — ليست تشخيصاً طبياً.',
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textTertiary,
                height: 1.45,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _focusInsightOnMap(ResultPriorityVM p) {
    HapticFeedback.selectionClick();
    final concernId = _concernIdForPriority(p);
    setState(() => _focusedConcernId = concernId);
    _mapPanelKey.currentState?.selectConcern(concernId);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _mapSectionKey.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(
          ctx,
          duration: const Duration(milliseconds: 380),
          curve: Curves.easeOutCubic,
          alignment: 0.05,
        );
      }
    });
  }

  String _concernIdForPriority(ResultPriorityVM p) {
    final fromAction = p.actionId.replaceFirst('action_', '');
    final concerns = _experience.map.concerns.map((c) => c.id).toList();
    for (final id in concerns) {
      if (id.toLowerCase().contains(fromAction.toLowerCase()) ||
          fromAction.toLowerCase().contains(id.toLowerCase())) {
        return id;
      }
    }
    final label = p.concernLabelAr;
    for (final id in concerns) {
      final public = MetricPresentationPolicy.publicLabelAr(id);
      if (label.contains(public) || public.contains(label)) return id;
    }
    return concerns.isNotEmpty ? concerns.first : fromAction;
  }

  void _openRoutine() {
    HapticFeedback.selectionClick();
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ResultsPersonalPlanScreen(
          report: widget.report,
          experience: _experience,
          isStale: widget.isStale,
        ),
      ),
    );
  }

  void _openAdvisor({String? initialQuestion}) {
    HapticFeedback.selectionClick();
    final focus = _focusedConcernId;
    final seed = initialQuestion ??
        (focus == null
            ? null
            : 'اشرحي لي مؤشر ${MetricPresentationPolicy.publicLabelAr(focus)} '
                'بناءً على تقريري، مع العلم أن المواقع المكانية من أقنعة الاكتشاف '
                '(${SkinClaimPolicy.mapTruthVerdict}).');
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs.skin(
        widget.report,
        initialQuestion: seed,
      ),
    );
  }

  void _showCosmeticDisclaimer(ResultExperience e) {
    final text = e.disclosures.isNotEmpty
        ? e.disclosures.first.summaryAr
        : 'نتيجة تجميلية استشارية — ليست تشخيصاً طبياً.';
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ElegantSheet(
        title: 'إخلاء مسؤولية',
        child: Text(text, style: AppTypography.bodyMedium.copyWith(height: 1.5)),
      ),
    );
  }
}

class _TruthBadgeRow extends StatelessWidget {
  const _TruthBadgeRow({required this.vitality, required this.map});

  final SkinTruthClass vitality;
  final SkinTruthClass map;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _Badge(label: 'حيوية البشرة · ${vitality.shortBadgeAr}'),
        _Badge(label: 'الخريطة · ${map.shortBadgeAr}'),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.primaryLight.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          color: AppColors.textSecondary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _RoutinePreview extends StatelessWidget {
  const _RoutinePreview({required this.plan, required this.onOpen});
  final ResultPersonalPlanVM plan;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final List<ResultRoutineStepVM> morning =
        plan.eligible ? plan.morning.steps.take(2).toList() : <ResultRoutineStepVM>[];
    final List<ResultRoutineStepVM> evening =
        plan.eligible ? plan.evening.steps.take(2).toList() : <ResultRoutineStepVM>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'روتين ميرا لك',
          style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        if (!plan.eligible)
          Text(
            'الروتين غير متاح لهذا التحليل',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
          )
        else ...[
          _RoutineLane(label: 'صباحًا', glyph: MiraSkinGlyphId.morning, steps: morning),
          const SizedBox(height: 8),
          _RoutineLane(label: 'مساءً', glyph: MiraSkinGlyphId.evening, steps: evening),
        ],
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: onOpen,
            child: const Text('الروتين الكامل'),
          ),
        ),
      ],
    );
  }
}

class _RoutineLane extends StatelessWidget {
  const _RoutineLane({
    required this.label,
    required this.glyph,
    required this.steps,
  });
  final String label;
  final MiraSkinGlyphId glyph;
  final List<ResultRoutineStepVM> steps;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            MiraSkinGlyphs.of(glyph, size: 18),
            const SizedBox(width: 6),
            Text(
              label,
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textTertiary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        for (final s in steps)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Material(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () {
                  HapticFeedback.selectionClick();
                  final reason = PublicLanguagePolicy.sanitize(s.reasonAr);
                  showModalBottomSheet<void>(
                    context: context,
                    backgroundColor: Colors.transparent,
                    builder: (ctx) => _ElegantSheet(
                      title: PublicLanguagePolicy.sanitize(s.titleAr),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'لماذا؟',
                            style: AppTypography.labelLarge.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            reason.isEmpty
                                ? 'خطوة عناية مرتبطة بمؤشرات تحليلك المتاحة.'
                                : reason,
                            style: AppTypography.bodyMedium.copyWith(height: 1.45),
                          ),
                        ],
                      ),
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          PublicLanguagePolicy.sanitize(s.titleAr),
                          style: AppTypography.bodyMedium,
                        ),
                      ),
                      Text(
                        'لماذا؟',
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _SkinJourneyCard extends StatelessWidget {
  const _SkinJourneyCard({required this.progress});
  final ResultProgressPreviewVM progress;

  @override
  Widget build(BuildContext context) {
    final projection = SkinClaimPolicy.linearProjectionCopyAr(progress);
    final headline = SkinClaimPolicy.sanitizeJourneyHeadlineAr(progress.summaryAr);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              MiraSkinGlyphs.of(MiraSkinGlyphId.journey, size: 20),
              const SizedBox(width: 8),
              Text(
                'رحلة بشرتك',
                style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            progress.comparability == ProgressComparabilityState.insufficientHistory
                ? 'هذه نقطة البداية لرحلتك'
                : 'مقارنة تاريخية',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textTertiary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            headline,
            style: AppTypography.bodyMedium.copyWith(
              color: AppColors.textSecondary,
              height: 1.45,
            ),
          ),
          if (progress.deltaVisible && progress.deltaPoints != null) ...[
            const SizedBox(height: 8),
            Text(
              'تغيّر رقمي ضمن مقارنة صالحة: ${progress.deltaPoints} نقطة — '
              'لا نسمّيه تلقائياً «تحسناً».',
              style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
            ),
          ],
          if (projection != null) ...[
            const SizedBox(height: 10),
            Text(
              projection,
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textTertiary,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AskMiraSkinBlock extends StatelessWidget {
  const _AskMiraSkinBlock({
    required this.questions,
    required this.onOpen,
    this.focusedMetricId,
  });

  final List<ResultAdvisorQuestionVM> questions;
  final void Function({String? initialQuestion}) onOpen;
  final String? focusedMetricId;

  @override
  Widget build(BuildContext context) {
    final presets = questions.isNotEmpty
        ? questions.map((q) => q.textAr).toList()
        : LocalAdvisorEngine.presetQuestions.take(3).toList();
    final focusLabel = focusedMetricId == null
        ? null
        : MetricPresentationPolicy.publicLabelAr(focusedMetricId!);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'اسألي ميرا عن بشرتك',
          style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
        ),
        if (focusLabel != null) ...[
          const SizedBox(height: 6),
          Text(
            'السياق الحالي: $focusLabel · خريطة استرشادية فقط',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textTertiary,
            ),
          ),
        ],
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: presets.map((q) {
            final safe = PublicLanguagePolicy.sanitize(q);
            if (SkinClaimPolicy.containsForbiddenMainClaim(safe)) {
              return const SizedBox.shrink();
            }
            return ActionChip(
              avatar: MiraSkinGlyphs.of(MiraSkinGlyphId.askMira, size: 16),
              label: Text(safe, style: AppTypography.labelSmall),
              backgroundColor: AppColors.primaryLight.withValues(alpha: 0.35),
              side: BorderSide(color: AppColors.border.withValues(alpha: 0.3)),
              onPressed: () => onOpen(initialQuestion: safe),
            );
          }).toList(),
        ),
        const SizedBox(height: 10),
        PremiumButton(
          label: AppSession.canUseCloud
              ? 'محادثة عن بشرتك'
              : 'اسألي ميرا (تجريبي)',
          variant: PremiumButtonVariant.ghost,
          onPressed: () => onOpen(),
        ),
      ],
    );
  }
}

class _TransparencyPanel extends StatelessWidget {
  const _TransparencyPanel({required this.experience});
  final ResultExperience experience;

  @override
  Widget build(BuildContext context) {
    final rows = <({String t, String s})>[
      (
        t: 'مؤشر حيوية البشرة',
        s: '${SkinClaimPolicy.vitalityTruthClass().labelAr} من مؤشرات التحليل المتاحة — ليس مقياس جمال.',
      ),
      (
        t: 'المؤشرات الأساسية',
        s: 'مقاسة عالمياً من تحليل الصورة عند توفرها (ترطيب، مسام، تجاعيد، …).',
      ),
      (
        t: 'خريطة البشرة',
        s: '${SkinClaimPolicy.mapTruthClass.labelAr}. الحكم الهندسي: ${SkinClaimPolicy.mapTruthVerdict}.',
      ),
      (
        t: 'الروتين',
        s: 'محسوب إرشادياً من مؤشراتك — عناية تجميلية وليست علاجاً.',
      ),
      (
        t: 'ثقة التحليل',
        s: ResultsConfidenceChip.shortLabelAr(experience.confidence.overall),
      ),
    ];

    if (SkinClaimPolicy.allowSkinAgeInTransparency(experience.skinAge)) {
      rows.add((
        t: 'تقدير المظهر العمري',
        s: 'محسوب تقريباً (${experience.skinAge.estimateYears} تقريباً) — '
            '${experience.skinAge.qualificationAr}',
      ));
    } else {
      rows.add((
        t: 'تقدير المظهر العمري',
        s: 'غير معروض في التقرير الرئيسي — لا مقارنة «تبدو أصغر/أكبر» كحقيقة مقاسة.',
      ));
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.28)),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Divider(height: 18),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(
                rows[i].t,
                style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(height: 4),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(
                rows[i].s,
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.45,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ElegantSheet extends StatelessWidget {
  const _ElegantSheet({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 16),
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 22),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
