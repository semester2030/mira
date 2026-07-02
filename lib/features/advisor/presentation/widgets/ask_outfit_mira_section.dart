import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../outfit_analysis/domain/entities/outfit_analysis.dart';
import '../../../outfit_analysis/domain/helpers/outfit_consultation_mapper.dart';

/// MCE Phase 3 — «اسألي ميرا عن إطلالتك» from outfit result.
class AskOutfitMiraSection extends StatelessWidget {
  final OutfitAnalysis analysis;
  final SkinReport? skinReport;

  const AskOutfitMiraSection({
    super.key,
    required this.analysis,
    this.skinReport,
  });

  void _openAdvisor(BuildContext context, {String? initialQuestion}) {
    Navigator.pushNamed(
      context,
      AppRoutes.miraAdvisor,
      arguments: AdvisorRouteArgs(
        outfitAnalysis: analysis,
        skinReport: skinReport,
        initialQuestion: initialQuestion,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.cardPurple.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.style_outlined, color: AppColors.secondary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('اسألي ميرا عن إطلالتك', style: AppTypography.titleMedium),
                    Text(
                      'استشارة أسلوب ومناسبة — مبنية على تحليلك',
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
            children: OutfitConsultationMapper.outfitStarterQuestions.map((q) {
              return ActionChip(
                label: Text(q, style: AppTypography.labelSmall),
                onPressed: () => _openAdvisor(context, initialQuestion: q),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          PremiumButton(
            label: AppSession.canUseCloud ? 'محادثة عن الإطلالة · MCE' : 'اسألي ميرا (تجريبي)',
            icon: Icons.chat_bubble_outline_rounded,
            variant: PremiumButtonVariant.secondary,
            onPressed: () => _openAdvisor(context),
          ),
        ],
      ),
    );
  }
}
