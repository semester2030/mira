import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';

/// Human tips — wired from recommendation_list style, no numeric metrics.
class MiraTipsSection extends StatelessWidget {
  final List<String> tips;

  const MiraTipsSection({super.key, required this.tips});

  @override
  Widget build(BuildContext context) {
    if (tips.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('نصائح ميرا', style: AppTypography.titleMedium),
        const SizedBox(height: 12),
        PremiumCard(
          child: Column(
            children: [
              for (var i = 0; i < tips.length; i++) ...[
                if (i > 0) const Divider(height: 20),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.spa_outlined, size: 18, color: AppColors.gold),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        tips[i],
                        style: AppTypography.bodyMedium.copyWith(height: 1.5),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
