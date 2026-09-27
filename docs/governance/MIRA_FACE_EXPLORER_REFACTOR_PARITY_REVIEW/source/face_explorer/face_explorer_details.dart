import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/spacing.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/face_map_overlay_decision.dart';
import '../../domain/perfect_mask_session.dart';
import '../../semantics/metric_presentation_policy.dart';
import '../geometry/skin_face_map_visual_tokens.dart';

/// Color legend + explain expander + provider measurement subregions.
class FaceExplorerDetailsSection extends StatelessWidget {
  const FaceExplorerDetailsSection({
    super.key,
    required this.selectedId,
    required this.overlayDecision,
    required this.holdingOriginal,
    required this.session,
    required this.selectedSubregion,
    required this.showSubregionDetails,
    required this.onToggleSubregions,
    required this.onSelectSubregion,
  });

  final String selectedId;
  final FaceMapOverlayDecision? overlayDecision;
  final bool holdingOriginal;
  final PerfectMaskSession? session;
  final String? selectedSubregion;
  final bool showSubregionDetails;
  final VoidCallback onToggleSubregions;
  final ValueChanged<String> onSelectSubregion;

  @override
  Widget build(BuildContext context) {
    final accent = SkinFaceMapVisualTokens.accentForConcern(selectedId);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (overlayDecision != null && !holdingOriginal) ...[
          FaceExplorerColorLegend(
            accent: accent,
            text: SkinFaceMapVisualTokens.mapLegendAr(
              selectedId,
              dataKind: overlayDecision!.dataKind,
              spatialVisible: overlayDecision!.showSpatialOverlay,
            ),
          ),
          const SizedBox(height: 12),
        ],
        Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: const EdgeInsets.only(bottom: 8),
            title: Text(
              'كيف أقرأ هذه النتيجة؟',
              style: AppTypography.labelMedium.copyWith(
                fontWeight: FontWeight.w800,
                color: SkinFaceMapVisualTokens.explorerOnBlack,
              ),
            ),
            children: [
              Text(
                MetricPresentationPolicy.faceExplorerHintAr(selectedId),
                style: AppTypography.labelSmall.copyWith(
                  color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'الدرجة العامة لا تُنسب إلى منطقة بعينها. موضع الفحص يحرّك العدسة فقط.',
                style: AppTypography.labelSmall.copyWith(
                  color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        ..._buildSubregionDisclosure(),
      ],
    );
  }

  List<Widget> _buildSubregionDisclosure() {
    final s = session;
    if (s == null) return const [];
    final regions = s.providerSubregions(selectedId);
    if (regions.length <= 1) return const [];
    final provider =
        PerfectMaskSession.providerTypeForConsumerMetric(selectedId) ?? '';
    if (provider != 'hd_pore' && provider != 'hd_wrinkle') {
      return const [];
    }
    return [
      const SizedBox(height: AppSpacing.sm),
      Center(
        child: TextButton(
          onPressed: () {
            HapticFeedback.selectionClick();
            onToggleSubregions();
          },
          style: TextButton.styleFrom(
            foregroundColor: SkinFaceMapVisualTokens.explorerOnBlack,
            minimumSize: const Size(48, 44),
          ),
          child: Text(
            showSubregionDetails ? 'إخفاء المناطق' : 'مناطق الوجه',
            style: AppTypography.labelMedium.copyWith(
              fontWeight: FontWeight.w700,
              color: SkinFaceMapVisualTokens.explorerOnBlack,
            ),
          ),
        ),
      ),
      if (showSubregionDetails) ...[
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            'اختيار المنطقة يُبرز قناعها المتاح من التحليل — لا تُنسب الدرجة العامة إلى المنطقة إن لم تتوفر درجة خاصة بها.',
            style: AppTypography.labelSmall.copyWith(
              color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              height: 1.35,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        AnimatedContainer(
          duration: SkinFaceMapVisualTokens.selectionTransition,
          margin: const EdgeInsets.only(top: 4),
          padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
          decoration: BoxDecoration(
            color: AppColors.background.withValues(alpha: 0.65),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: regions.map((r) {
              final on = (selectedSubregion ?? 'whole') == r;
              final label = MetricPresentationPolicy.subregionLabelAr(r);
              final accent =
                  SkinFaceMapVisualTokens.accentForConcern(selectedId);
              return Semantics(
                selected: on,
                button: true,
                label: label,
                child: Material(
                  color: on
                      ? accent.withValues(alpha: 0.22)
                      : AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => onSelectSubregion(r),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 11,
                      ),
                      child: Text(
                        label,
                        style: AppTypography.labelSmall.copyWith(
                          fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                          color: on
                              ? AppColors.primaryDark
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    ];
  }
}

class FaceExplorerColorLegend extends StatelessWidget {
  const FaceExplorerColorLegend({
    super.key,
    required this.accent,
    required this.text,
  });

  final Color accent;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 9,
          height: 9,
          margin: const EdgeInsets.only(top: 5),
          decoration: BoxDecoration(
            color: accent,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: AppTypography.labelSmall.copyWith(
              color: SkinFaceMapVisualTokens.explorerOnBlackMuted,
              height: 1.35,
              fontSize: 12,
            ),
          ),
        ),
      ],
    );
  }
}
