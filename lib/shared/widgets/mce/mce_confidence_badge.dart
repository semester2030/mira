import 'package:flutter/material.dart';

import '../../theme/colors.dart';
import '../../theme/typography.dart';

class MceConfidenceBadge extends StatelessWidget {
  final String confidence;

  const MceConfidenceBadge({super.key, required this.confidence});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (confidence) {
      'high' => ('ثقة عالية', AppColors.success),
      'low' => ('ثقة منخفضة', AppColors.gold),
      _ => ('ثقة متوسطة', AppColors.secondary),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
