import 'package:flutter/material.dart';

import '../../../../core/ai/models/makeup_recommendation.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../../../shared/widgets/premium/section_header.dart';

class MakeupSection extends StatelessWidget {
  final MakeupRecommendation makeup;

  const MakeupSection({super.key, required this.makeup});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'المكياج المقترح'),
        PremiumCard(
          child: Column(
            children: [
              _row('أحمر الشفاه', makeup.lipstickAr),
              _row('الظلال', makeup.eyeshadowAr),
              _row('البلاشر', makeup.blushAr),
            ],
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTypography.bodyMedium),
          Text(value, style: AppTypography.titleMedium),
        ],
      ),
    );
  }
}
