import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../geometry/skin_face_map_visual_tokens.dart';
import 'face_explorer_controller.dart';

IconData faceExplorerMetricIcon(String id) {
  final k = id.toLowerCase();
  if (k.contains('pore') || k.contains('مسام')) return Icons.grid_view_rounded;
  if (k.contains('wrinkle') || k.contains('تجاعيد')) return Icons.waves_rounded;
  if (k.contains('acne') || k.contains('حبوب')) return Icons.circle_outlined;
  if (k.contains('pigment') || k.contains('تصبغ')) {
    return Icons.auto_awesome_outlined;
  }
  if (k.contains('hydrat') || k.contains('moisture') || k.contains('ترطيب')) {
    return Icons.water_drop_outlined;
  }
  if (k.contains('oil') || k.contains('دهون')) return Icons.wb_sunny_outlined;
  if (k.contains('redness') || k.contains('احمرار')) {
    return Icons.favorite_border_rounded;
  }
  if (k.contains('texture') || k.contains('ملمس')) {
    return Icons.texture_rounded;
  }
  if (k.contains('radiance') || k.contains('إشراق') || k.contains('اشراق')) {
    return Icons.wb_iridescent_outlined;
  }
  return Icons.face_retouching_natural_outlined;
}

/// Intro row + ordered 3×2 primary metric grid (+ optional extras).
class FaceExplorerMetricsSection extends StatelessWidget {
  const FaceExplorerMetricsSection({
    super.key,
    required this.concerns,
    required this.selectedId,
    required this.showAll,
    required this.onSelect,
    required this.onToggleAll,
  });

  final List<ResultMapConcernVM> concerns;
  final String? selectedId;
  final bool showAll;
  final ValueChanged<String> onSelect;
  final VoidCallback onToggleAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'اختاري ما تودّين استكشافه',
                style: AppTypography.labelMedium.copyWith(
                  fontWeight: FontWeight.w700,
                  color: SkinFaceMapVisualTokens.explorerOnBlack,
                ),
              ),
            ),
            TextButton(
              onPressed: onToggleAll,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
                minimumSize: const Size(48, 40),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              child: Text(
                showAll ? 'المؤشرات الأساسية' : 'كل المؤشرات',
                style: AppTypography.labelSmall.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        FaceExplorerMetricGrid(
          concerns: concerns,
          selectedId: selectedId,
          primaryIds: FaceExplorerController.primaryConsumerIds,
          showAll: showAll,
          onSelect: onSelect,
        ),
      ],
    );
  }
}

/// Score reading strip above the face photo.
class FaceExplorerReadingStrip extends StatelessWidget {
  const FaceExplorerReadingStrip({
    super.key,
    required this.metricId,
    required this.uiScore,
    required this.accent,
  });

  final String metricId;
  final double? uiScore;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final title = MetricPresentationPolicy.publicLabelAr(metricId);
    final status = MetricPresentationPolicy.faceExplorerStatusAr(uiScore);
    return Semantics(
      label: [
        title,
        if (uiScore != null) '${uiScore!.round()} / 100',
        if (status.isNotEmpty) status,
      ].join(' '),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.titleSmall.copyWith(
                    fontWeight: FontWeight.w800,
                    color: accent,
                    fontSize: 17,
                  ),
                ),
                Text(
                  'الدرجة العامة',
                  style: AppTypography.labelSmall.copyWith(
                    color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          if (uiScore != null)
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              textDirection: TextDirection.ltr,
              children: [
                Text(
                  '${uiScore!.round()}',
                  style: AppTypography.titleSmall.copyWith(
                    fontSize: 31,
                    fontWeight: FontWeight.w800,
                    height: 1,
                    color: SkinFaceMapVisualTokens.explorerOnBlack,
                  ),
                ),
                Text(
                  ' /100',
                  style: AppTypography.labelSmall.copyWith(
                    color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (status.isNotEmpty)
                Text(
                  status,
                  style: AppTypography.labelSmall.copyWith(
                    fontWeight: FontWeight.w700,
                    color: SkinFaceMapVisualTokens.explorerOnBlack,
                  ),
                ),
              Text(
                'الأعلى أفضل',
                style: AppTypography.labelSmall.copyWith(
                  color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class FaceExplorerMetricGrid extends StatelessWidget {
  const FaceExplorerMetricGrid({
    super.key,
    required this.concerns,
    required this.selectedId,
    required this.primaryIds,
    required this.showAll,
    required this.onSelect,
  });

  final List<ResultMapConcernVM> concerns;
  final String? selectedId;
  final List<String> primaryIds;
  final bool showAll;
  final ValueChanged<String> onSelect;

  bool _isPrimary(ResultMapConcernVM c) {
    final id = c.id.toLowerCase();
    return primaryIds.any((p) => id.contains(p) || p.contains(id));
  }

  /// Explicit order after id unification — `where` alone does not sort.
  List<ResultMapConcernVM> _orderedPrimary() {
    final out = <ResultMapConcernVM>[];
    final used = <String>{};
    for (final p in primaryIds) {
      ResultMapConcernVM? match;
      for (final c in concerns) {
        final id = c.id.toLowerCase();
        if (id == p || id.contains(p) || p.contains(id)) {
          match = c;
          break;
        }
      }
      if (match != null && used.add(match.id)) out.add(match);
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final primary = _orderedPrimary();
    final rest = concerns.where((c) => !_isPrimary(c)).toList();
    final shown = showAll ? [...primary, ...rest] : primary;
    final effective = shown.isEmpty && concerns.isNotEmpty ? concerns : shown;
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 7,
      crossAxisSpacing: 7,
      childAspectRatio: 2.35,
      children: effective.map((c) {
        final on = selectedId == c.id;
        final label = MetricPresentationPolicy.publicLabelAr(c.id);
        final accent = SkinFaceMapVisualTokens.accentForConcern(c.id);
        return Semantics(
          button: true,
          selected: on,
          label: label,
          child: Material(
            color: on ? accent.withValues(alpha: 0.16) : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => onSelect(c.id),
              child: Container(
                alignment: Alignment.center,
                padding:
                    const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: on
                        ? accent.withValues(alpha: 0.95)
                        : AppColors.border.withValues(alpha: 0.45),
                    width: on ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      faceExplorerMetricIcon(c.id),
                      size: 17,
                      color: on ? accent : AppColors.textSecondary,
                    ),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.labelSmall.copyWith(
                          fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                          fontSize: 12,
                          color: on ? accent : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
