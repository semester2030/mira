import 'package:flutter/material.dart';

import '../../../../core/ai/models/styling_recommendation.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../../../shared/widgets/premium/section_header.dart';

class StylingSection extends StatelessWidget {
  final StylingRecommendation styling;

  const StylingSection({super.key, required this.styling});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'الإكسسوارات'),
        PremiumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: styling.accessoriesAr
                .map(
                  (a) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text('• $a', style: AppTypography.bodyLarge.copyWith(height: 1.5)),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }
}
