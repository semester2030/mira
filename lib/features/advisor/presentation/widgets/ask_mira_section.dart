import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../intelligence/domain/entities/mira_beauty_report.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../domain/services/local_advisor_engine.dart';

/// Phase 7a — «اسألي ميرا» entry from beauty report.
class AskMiraSection extends StatelessWidget {
  final SkinReport report;
  final MiraBeautyReport mira;

  const AskMiraSection({
    super.key,
    required this.report,
    required this.mira,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.goldLight.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.chat_bubble_outline_rounded, color: AppColors.gold),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('اسألي ميرا', style: AppTypography.titleMedium),
                  Text(
                    'مستشارة شخصية — مبنية على تقريرك',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: LocalAdvisorEngine.presetQuestions.map((q) {
            return ActionChip(
              label: Text(q, style: AppTypography.labelSmall),
              onPressed: () => Navigator.pushNamed(
                context,
                AppRoutes.miraAdvisor,
                arguments: AdvisorRouteArgs(report: report, initialQuestion: q),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 10),
        PremiumButton(
          label: AppSession.canUseCloud ? 'محادثة مع مستشار ميرا' : 'اسألي ميرا (تجريبي)',
          icon: Icons.auto_awesome_outlined,
          variant: PremiumButtonVariant.secondary,
          onPressed: () => Navigator.pushNamed(
            context,
            AppRoutes.miraAdvisor,
            arguments: AdvisorRouteArgs(report: report),
          ),
        ),
      ],
    );
  }
}
