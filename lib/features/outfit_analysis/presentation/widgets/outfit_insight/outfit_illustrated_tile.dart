import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../../../../../shared/widgets/premium/pressable_scale.dart';
import '../outfit_result_motion.dart';
import 'outfit_illustration_painter.dart';
import 'outfit_insight_item.dart';

/// Single illustrated tile — tap reveals label + color detail.
class OutfitIllustratedTile extends StatelessWidget {
  final OutfitInsightItem item;
  final double width;
  final double height;

  const OutfitIllustratedTile({
    super.key,
    required this.item,
    this.width = 78,
    this.height = 88,
  });

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () {
        HapticFeedback.lightImpact();
        _showDetail(context);
      },
      child: SizedBox(
        width: width,
        height: height,
        child: CustomPaint(
          painter: OutfitIllustrationPainter(
            kind: item.kind,
            primary: item.primary,
            accent: item.accent,
          ),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
        child: OutfitStaggerPop(
          index: 0,
          baseDelayMs: 0,
          child: Container(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 22),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
              boxShadow: [
                BoxShadow(
                  color: AppColors.secondary.withValues(alpha: 0.15),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                OutfitFloatIdle(
                  child: SizedBox(
                    width: 96,
                    height: 96,
                    child: CustomPaint(
                      painter: OutfitIllustrationPainter(
                        kind: item.kind,
                        primary: item.primary,
                        accent: item.accent,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(item.labelAr, style: AppTypography.titleMedium),
                if (item.subtitleAr != null && item.subtitleAr!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    item.subtitleAr!,
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _colorDot(item.primary, 'اللون الأساسي'),
                    const SizedBox(width: 16),
                    _colorDot(item.accent, 'لمسة مكملة'),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _colorDot(Color c, String label) {
    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: c,
            border: Border.all(color: AppColors.border),
          ),
        ),
        const SizedBox(height: 4),
        Text(label, style: AppTypography.labelSmall.copyWith(fontSize: 10)),
      ],
    );
  }
}
