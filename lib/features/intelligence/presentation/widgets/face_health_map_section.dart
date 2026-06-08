import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/face_health_map.dart';
import 'face_diagram_painter.dart';

/// Section 4 — Educational or spatial Face Health Map.
class FaceHealthMapSection extends StatelessWidget {
  final FaceHealthMap map;

  const FaceHealthMapSection({super.key, required this.map});

  @override
  Widget build(BuildContext context) {
    if (!map.enabled) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PremiumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primaryLight.withValues(alpha: 0.9),
                          AppColors.cardPurple.withValues(alpha: 0.7),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      map.isEducational
                          ? Icons.face_retouching_natural_outlined
                          : Icons.biotech_outlined,
                      color: AppColors.primaryDark,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(map.titleAr, style: AppTypography.titleMedium),
                        if (map.subtitleAr.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            map.subtitleAr,
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _ConfidenceBadge(confidence: map.confidence, label: map.confidenceLabelAr),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      AppColors.background,
                      AppColors.cardPink.withValues(alpha: 0.35),
                    ],
                  ),
                  border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                child: SizedBox(
                  height: 300,
                  width: double.infinity,
                  child: CustomPaint(
                    painter: FaceDiagramPainter(zones: map.zones),
                  ),
                ),
              ),
              if (map.disclaimerAr.isNotEmpty) ...[
                const SizedBox(height: 14),
                _DisclaimerBox(text: map.disclaimerAr),
              ],
            ],
          ),
        ),
        if (map.insightCards.isNotEmpty) ...[
          const SizedBox(height: 12),
          ...map.insightCards.map(
            (card) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: PremiumCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 4,
                      height: 48,
                      decoration: BoxDecoration(
                        color: _parseHex(
                          map.zones
                                  .where((z) => z.highlight)
                                  .map((z) => z.highlightColor)
                                  .firstOrNull ??
                              '#C19EE0',
                        ),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            card.concernLabelAr,
                            style: AppTypography.labelLarge.copyWith(
                              color: AppColors.primaryDark,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            card.zoneLabelAr,
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textTertiary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            card.bodyAr,
                            style: AppTypography.bodyMedium.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.6,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Color _parseHex(String hex) {
    final value = hex.replaceFirst('#', '');
    return Color(int.parse('FF$value', radix: 16));
  }
}

class _ConfidenceBadge extends StatelessWidget {
  final String confidence;
  final String label;

  const _ConfidenceBadge({required this.confidence, required this.label});

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (confidence) {
      'high' => (AppColors.cardPurple, AppColors.primaryDark, Icons.verified_outlined),
      'medium' => (AppColors.cardBlue, AppColors.info, Icons.layers_outlined),
      _ => (AppColors.goldLight, const Color(0xFF8D6E00), Icons.info_outline),
    };

    return Container(
      constraints: const BoxConstraints(maxWidth: 110),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              style: AppTypography.labelSmall.copyWith(color: fg, height: 1.2),
              maxLines: 3,
            ),
          ),
        ],
      ),
    );
  }
}

class _DisclaimerBox extends StatelessWidget {
  final String text;

  const _DisclaimerBox({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.cardOrange.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.45)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.shield_outlined, size: 18, color: Color(0xFF8D6E00)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
                height: 1.55,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
