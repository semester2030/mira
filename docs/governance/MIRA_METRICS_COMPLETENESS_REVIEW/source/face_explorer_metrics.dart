import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../geometry/skin_face_map_visual_tokens.dart';
import 'face_explorer_concern_catalog.dart';

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
  if (k.contains('dark_circle') || k.contains('هالة')) {
    return Icons.remove_red_eye_outlined;
  }
  if (k.contains('eye_bag') || k.contains('droopy') || k.contains('جفن')) {
    return Icons.visibility_outlined;
  }
  return Icons.face_retouching_natural_outlined;
}

/// Intro row + ordered 3×2 primary metric grid (+ optional extras).
class FaceExplorerMetricsSection extends StatelessWidget {
  const FaceExplorerMetricsSection({
    super.key,
    required this.catalog,
    required this.selectedId,
    required this.showAll,
    required this.onSelect,
    required this.onToggleAll,
  });

  final FaceExplorerConcernCatalogResult catalog;
  final String? selectedId;
  final bool showAll;
  final ValueChanged<String> onSelect;
  final VoidCallback onToggleAll;

  @override
  Widget build(BuildContext context) {
    final hasExtras = catalog.extras.isNotEmpty;
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
            if (hasExtras)
              TextButton.icon(
                onPressed: onToggleAll,
                icon: Icon(
                  showAll ? Icons.unfold_less_rounded : Icons.apps_rounded,
                  size: 18,
                ),
                label: Text(
                  showAll ? 'إخفاء المؤشرات الإضافية' : 'كل المؤشرات',
                  style: AppTypography.labelSmall.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  minimumSize: const Size(48, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        FaceExplorerMetricGrid(
          slots: catalog.visible(showAll: showAll),
          selectedId: selectedId,
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
    this.scoreRegion,
    this.slotStatus,
  });

  final String metricId;
  final double? uiScore;
  final Color accent;
  final String? scoreRegion;
  final FaceExplorerMetricSlotStatus? slotStatus;

  @override
  Widget build(BuildContext context) {
    final title = MetricPresentationPolicy.publicLabelAr(metricId);
    final status = uiScore == null
        ? ''
        : MetricPresentationPolicy.faceExplorerStatusAr(uiScore);
    final region = scoreRegion;
    final isRegional =
        region != null &&
        region != 'whole' &&
        region != 'all' &&
        region != 'root';
    final regionLabel = isRegional
        ? MetricPresentationPolicy.subregionLabelAr(region)
        : null;
    final honestEmpty = slotStatus == FaceExplorerMetricSlotStatus.analyzing
        ? 'جارٍ التحليل'
        : (slotStatus == FaceExplorerMetricSlotStatus.unavailable
              ? 'غير متاح'
              : null);
    final scopeLabel = regionLabel != null
        ? (uiScore == null
              ? (honestEmpty != null
                    ? '$regionLabel — $honestEmpty'
                    : '$regionLabel — لا تتوفر درجة')
              : 'درجة $regionLabel')
        : (uiScore == null
              ? (honestEmpty ?? 'الدرجة غير متاحة')
              : 'الدرجة العامة');
    return Semantics(
      label: [
        title,
        scopeLabel,
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
                  scopeLabel,
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
          if (uiScore != null) ...[
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
        ],
      ),
    );
  }
}

class FaceExplorerMetricGrid extends StatelessWidget {
  const FaceExplorerMetricGrid({
    super.key,
    required this.slots,
    required this.selectedId,
    required this.onSelect,
  });

  final List<FaceExplorerMetricSlot> slots;
  final String? selectedId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 7,
        crossAxisSpacing: 7,
        childAspectRatio: 2.15,
        children: slots.map((slot) {
          final on = selectedId == slot.id;
          final ready = slot.status == FaceExplorerMetricSlotStatus.ready;
          final accent = SkinFaceMapVisualTokens.accentForConcern(slot.id);
          final muted = SkinFaceMapVisualTokens.explorerOnBlackMuted;
          final label = ready ? slot.labelAr : slot.statusLabelAr;
          return Semantics(
            button: true,
            selected: on,
            enabled: true,
            label: '${slot.labelAr}. $label',
            child: Material(
              color: on
                  ? accent.withValues(alpha: 0.16)
                  : (ready
                        ? AppColors.surface
                        : AppColors.surface.withValues(alpha: 0.72)),
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => onSelect(slot.id),
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: on
                          ? accent.withValues(alpha: 0.95)
                          : AppColors.border.withValues(alpha: 0.45),
                      width: on ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            faceExplorerMetricIcon(slot.id),
                            size: 16,
                            color: on
                                ? accent
                                : (ready ? AppColors.textSecondary : muted),
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              slot.labelAr,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.labelSmall.copyWith(
                                fontWeight: on
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                                fontSize: 12,
                                color: on
                                    ? accent
                                    : (ready ? AppColors.textSecondary : muted),
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (!ready)
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.labelSmall.copyWith(
                            fontSize: 9,
                            color: muted,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
