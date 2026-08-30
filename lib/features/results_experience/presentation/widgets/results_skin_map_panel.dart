import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../intelligence/presentation/widgets/beauty_report_face_map/beauty_report_face_map.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../visibility/visibility_policy.dart';
import '../../semantics/metric_presentation_policy.dart';
import 'results_confidence_chip.dart';

/// Phase 8D — Mode B illustrative skin map (never measured localization).
class ResultsSkinMapPanel extends StatefulWidget {
  const ResultsSkinMapPanel({
    super.key,
    required this.map,
    required this.metrics,
    required this.onAskMira,
    required this.onInfoOpened,
    required this.onConcernSelected,
    required this.onUnavailable,
    this.onOpenRoutine,
    this.isStale = false,
    this.missingImage = false,
  });

  final ResultMapVM map;
  final List<ResultMetricVM> metrics;
  final ValueChanged<String> onAskMira;
  final VoidCallback onInfoOpened;
  final ValueChanged<String> onConcernSelected;
  final VoidCallback onUnavailable;
  final VoidCallback? onOpenRoutine;
  final bool isStale;
  final bool missingImage;

  @override
  State<ResultsSkinMapPanel> createState() => _ResultsSkinMapPanelState();
}

class _ResultsSkinMapPanelState extends State<ResultsSkinMapPanel> {
  String? _selectedId;
  var _loggedUnavailable = false;

  List<ResultMapConcernVM> get _concerns => widget.map.concerns
      .where((c) => VisibilityPolicy.isPubliclyVisible(c.visibility))
      .toList();

  @override
  void initState() {
    super.initState();
    final concerns = _concerns;
    _selectedId = concerns.isNotEmpty ? concerns.first.id : null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!_mapUsable && !_loggedUnavailable) {
        _loggedUnavailable = true;
        widget.onUnavailable();
      }
    });
  }

  bool get _mapUsable {
    if (widget.missingImage) return false;
    if (widget.map.visibility == VisibilityState.unavailable ||
        widget.map.visibility == VisibilityState.hiddenMissingEvidence) {
      return false;
    }
    if (!widget.map.interactionEligible) return false;
    if (widget.map.mode != MapPresentationMode.illustrativeUserImage) {
      return false;
    }
    return _concerns.isNotEmpty;
  }

  ResultMetricVM? _metricFor(String concernId) {
    for (final m in widget.metrics) {
      final id = MetricPresentationPolicy.rawMetricId(m).toLowerCase();
      if (concernId.toLowerCase().contains(id) ||
          id.contains(concernId.toLowerCase()) ||
          MetricPresentationPolicy.publicLabelAr(concernId) == m.titleAr) {
        return m;
      }
    }
    final label = MetricPresentationPolicy.publicLabelAr(concernId);
    for (final m in widget.metrics) {
      if (m.titleAr.contains(label) || label.contains(m.titleAr)) return m;
    }
    return null;
  }

  int _scoreFor(String concernId) {
    final m = _metricFor(concernId);
    final primary =
        m == null ? null : MetricPresentationPolicy.primaryScore(m);
    if (primary?.value != null) return primary!.value!.round().clamp(0, 100);
    return 55;
  }

  @override
  Widget build(BuildContext context) {
    if (!_mapUsable) {
      return _UnavailableState(
        isStale: widget.isStale,
        missingImage: widget.missingImage,
        lowConfidence: widget.map.confidence == ConfidenceState.low ||
            widget.map.confidence == ConfidenceState.unavailable,
      );
    }

    final selected = _selectedId ?? _concerns.first.id;
    final metric = _metricFor(selected);
    final status = metric == null
        ? 'إرشادي'
        : MetricPresentationPolicy.publicStatusAr(metric);
    final action = metric == null
        ? 'راجعي المؤشر النصي المرتبط'
        : MetricPresentationPolicy.ownedActionAr(metric);
    final explanation = metric?.explanationAr.isNotEmpty == true
        ? metric!.explanationAr
        : 'مناطق شائعة مرتبطة بهذه النتيجة — عرض إرشادي فقط.';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(widget.map.titleAr, style: AppTypography.titleMedium),
            ),
            IconButton(
              tooltip: 'عن الخريطة',
              onPressed: () {
                widget.onInfoOpened();
                _showMapInfo(context);
              },
              icon: const Icon(Icons.info_outline_rounded),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Badge(widget.map.badgeAr),
            ResultsConfidenceChip(state: widget.map.confidence, compact: true),
            if (widget.isStale) const _Badge('نتيجة سابقة'),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'عرض على وجه توضيحي · التظليل إرشادي وليس قياساً موضعياً',
          style: AppTypography.labelSmall.copyWith(
            color: AppColors.textSecondary,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final c in _concerns)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 8),
                  child: ChoiceChip(
                    label: Text(c.labelAr),
                    selected: c.id == selected,
                    onSelected: (_) {
                      setState(() => _selectedId = c.id);
                      widget.onConcernSelected(c.id);
                    },
                    selectedColor: AppColors.goldLight,
                    labelStyle: AppTypography.labelSmall.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Semantics(
          label:
              'خريطة إرشادية. ${widget.map.explanationAr}. المؤشر المحدد ${MetricPresentationPolicy.publicLabelAr(selected)}. الحالة $status',
          child: ExcludeSemantics(
            child: AnimatedBeautyReportFaceMap(
              concernId: selected,
              highlightZoneIds: const [],
              concernScore: _scoreFor(selected),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          MetricPresentationPolicy.publicLabelAr(selected),
          style: AppTypography.titleSmall,
        ),
        const SizedBox(height: 4),
        Text(
          'الحالة: $status',
          style: AppTypography.labelLarge.copyWith(
            color: AppColors.primaryDark,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          explanation,
          style: AppTypography.bodyMedium.copyWith(height: 1.45),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 8),
        Text(
          'الخطوة المرتبطة: $action',
          style: AppTypography.bodySmall.copyWith(
            fontWeight: FontWeight.w600,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          widget.map.explanationAr,
          style: AppTypography.labelSmall.copyWith(
            color: AppColors.textSecondary,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 14),
        OutlinedButton(
          onPressed: () => widget.onAskMira(selected),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(46),
          ),
          child: const Text('اسألي مستشار ميرا عن هذا المؤشر'),
        ),
        if (widget.onOpenRoutine != null) ...[
          const SizedBox(height: 8),
          TextButton(
            onPressed: widget.onOpenRoutine,
            child: const Text('عرض الإرشاد في روتينك'),
          ),
        ],
      ],
    );
  }

  void _showMapInfo(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.map.titleAr, style: AppTypography.titleMedium),
            const SizedBox(height: 8),
            Text(widget.map.badgeAr, style: AppTypography.labelLarge),
            const SizedBox(height: 10),
            Text(
              widget.map.explanationAr,
              style: AppTypography.bodyMedium.copyWith(height: 1.55),
            ),
            const SizedBox(height: 10),
            Text(
              'مناطق شائعة مرتبطة بالنتيجة · توضيح بصري · ليست خريطة طبية أو قياساً موضعياً دقيقاً.',
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFE8EEF5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF4A6572).withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          color: const Color(0xFF4A6572),
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _UnavailableState extends StatelessWidget {
  const _UnavailableState({
    required this.isStale,
    required this.missingImage,
    required this.lowConfidence,
  });

  final bool isStale;
  final bool missingImage;
  final bool lowConfidence;

  @override
  Widget build(BuildContext context) {
    var msg =
        'تعذر عرض الخريطة الإرشادية لهذه النتيجة، لكن يمكنك مراجعة المؤشرات النصية أو إعادة التحليل لاحقاً.';
    if (missingImage) {
      msg =
          'تعذر عرض الخريطة لأن صورة الوجه غير متاحة. يمكنك متابعة المؤشرات النصية.';
    } else if (lowConfidence) {
      msg =
          'تعذر عرض الخريطة الإرشادية بوضوح لأن ثقة التحليل محدودة. راجعي المؤشرات النصية أو أعيدي التحليل.';
    } else if (isStale) {
      msg =
          'تعذر عرض الخريطة الإرشادية لأن هذه نتيجة سابقة. راجعي المؤشرات النصية أو أعيدي التحليل.';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('خريطة إرشادية للبشرة', style: AppTypography.titleMedium),
          const SizedBox(height: 8),
          const _Badge('توضيح إرشادي'),
          const SizedBox(height: 12),
          Text(msg, style: AppTypography.bodyMedium.copyWith(height: 1.5)),
        ],
      ),
    );
  }
}
