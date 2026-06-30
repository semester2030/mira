import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/navigation/analysis_navigation.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/outfit_compare_snapshot.dart';
import '../../domain/helpers/outfit_analysis_mapper.dart';
import '../../domain/services/outfit_occasion_scoring.dart';
import '../widgets/outfit_color_alternative_panel.dart';
import '../widgets/outfit_color_harmony_panel.dart';
import '../widgets/outfit_insight_cards.dart';
import '../widgets/outfit_look_result_hero.dart';
import '../widgets/outfit_next_occasion_card.dart';
import '../widgets/outfit_result_motion.dart';
import '../widgets/outfit_segment_map_overlay.dart';
import '../widgets/outfit_why_this_works_section.dart';

class OutfitResultScreen extends StatelessWidget {
  final OutfitAnalysis analysis;

  const OutfitResultScreen({super.key, required this.analysis});

  @override
  Widget build(BuildContext context) {
    AnalysisSession.setOutfitIntelligence(analysis);
    AnalysisSession.setOutfit(OutfitAnalysisMapper.toLegacyReport(analysis));

    final hasPhoto = analysis.frozenImagePath != null &&
        File(analysis.frozenImagePath!).existsSync();
    final hasTrustedMap = analysis.segmentMap?.hasTrustedOverlay == true;

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'نتيجة الإطلالة'),
      body: CelebrationOnMount(
        message: AnalysisCelebration.messageForOutfit(),
        child: OutfitResultAmbience(
          child: FloatingGradientBackground(
            showOrbs: false,
            showParticles: false,
            child: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                child: StaggeredEntrance(
                  children: [
                    OutfitLookResultHero(analysis: analysis),
                    const SizedBox(height: 14),
                    OutfitNextOccasionCard(
                      analysis: analysis,
                      onTryOccasion: () {
                        final next = OutfitOccasionScoring.suggestNext(analysis);
                        AnalysisNavigation.openOutfitAnalysis(context);
                        if (next != null && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('اختاري مناسبة «${next.occasion.labelAr}» في الخطوة التالية'),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      },
                    ),
                    if (hasPhoto && hasTrustedMap) ...[
                      const SizedBox(height: 16),
                      _PhotoAnalysisCard(analysis: analysis),
                    ] else if (hasPhoto && analysis.segmentMap?.validationMessage != null) ...[
                      const SizedBox(height: 16),
                      _VisualValidationNotice(message: analysis.segmentMap!.validationMessage!),
                    ],
                    const SizedBox(height: 16),
                    OutfitColorHarmonyPanel(analysis: analysis),
                    const SizedBox(height: 16),
                    OutfitWhyThisWorksSection(analysis: analysis),
                    const SizedBox(height: 16),
                    OutfitColorAlternativePanel(analysis: analysis),
                    const SizedBox(height: 16),
                    OutfitInsightCards(analysis: analysis),
                  if (analysis.matchReasons.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _ReasonSection(
                      title: 'نقاط القوة',
                      icon: Icons.check_circle_outline_rounded,
                      color: AppColors.success,
                      items: analysis.matchReasons.take(3).toList(),
                    ),
                  ],
                  if (analysis.mismatchReasons.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _ReasonSection(
                      title: 'القطع التي تحتاج تعديل',
                      icon: Icons.info_outline_rounded,
                      color: AppColors.gold,
                      items: analysis.mismatchReasons,
                    ),
                  ],
                  if (analysis.recommendations.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _ReasonSection(
                      title: 'اقتراحات التحسين',
                      icon: Icons.auto_fix_high_outlined,
                      color: AppColors.secondary,
                      items: analysis.recommendations,
                    ),
                  ],
                  if (analysis.isSmartMode && analysis.suggestedMakeup.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('مكياج مقترح', style: AppTypography.titleMedium),
                          const SizedBox(height: 8),
                          Text(
                            analysis.suggestedMakeup,
                            style: AppTypography.bodyMedium.copyWith(height: 1.5),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  PremiumButton(
                    label: 'قارني مع إطلالة من السجل',
                    icon: Icons.compare_arrows_rounded,
                    variant: PremiumButtonVariant.secondary,
                    onPressed: () {
                      Navigator.pushNamed(
                        context,
                        AppRoutes.outfitHistory,
                        arguments: OutfitHistoryRouteArgs(
                          anchorSnapshot: OutfitCompareSnapshot.fromAnalysis(analysis),
                          startCompareMode: true,
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                  if (AnalysisSession.canBuildFullRecommendation) ...[
                    PremiumButton(
                      label: 'توصيات ميرا الكاملة',
                      icon: Icons.auto_awesome_rounded,
                      variant: PremiumButtonVariant.gold,
                      onPressed: () => PrivacyNavigation.openRecommendations(
                        context,
                        skin: AnalysisSession.lastSkin,
                        outfit: AnalysisSession.lastOutfit,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  PremiumButton(
                    label: 'تحليل إطلالة أخرى',
                    icon: Icons.refresh_rounded,
                    variant: PremiumButtonVariant.secondary,
                    onPressed: () => AnalysisNavigation.openOutfitAnalysis(context),
                  ),
                  const SizedBox(height: 8),
                  PremiumButton(
                    label: 'العودة للرئيسية',
                    variant: PremiumButtonVariant.secondary,
                    onPressed: () => Navigator.pushNamedAndRemoveUntil(
                      context,
                      AppRoutes.dashboard,
                      (_) => false,
                    ),
                  ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _VisualValidationNotice extends StatelessWidget {
  final String message;

  const _VisualValidationNotice({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(Icons.visibility_off_outlined, color: AppColors.gold, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: AppTypography.bodySmall.copyWith(height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotoAnalysisCard extends StatelessWidget {
  final OutfitAnalysis analysis;

  const _PhotoAnalysisCard({required this.analysis});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'خريطة القطع — كشف بصري حقيقي',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'إطارات من Google Vision داخل منطقة الجسم فقط',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          OutfitSegmentMapOverlay(
            imageFile: File(analysis.frozenImagePath!),
            segmentMap: analysis.segmentMap!,
          ),
        ],
      ),
    );
  }
}

class _ReasonSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final List<String> items;

  const _ReasonSection({
    required this.title,
    required this.icon,
    required this.color,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: AppTypography.titleMedium),
        const SizedBox(height: 10),
        PremiumCard(
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const Divider(height: 20),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, size: 18, color: color),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        items[i],
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
