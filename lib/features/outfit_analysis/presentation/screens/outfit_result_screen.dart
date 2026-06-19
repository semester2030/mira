import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/navigation/analysis_navigation.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/confidence_badge.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/helpers/outfit_analysis_mapper.dart';
import '../widgets/outfit_segment_map_overlay.dart';

class OutfitResultScreen extends StatelessWidget {
  final OutfitAnalysis analysis;

  const OutfitResultScreen({super.key, required this.analysis});

  @override
  Widget build(BuildContext context) {
    AnalysisSession.setOutfitIntelligence(analysis);
    AnalysisSession.setOutfit(OutfitAnalysisMapper.toLegacyReport(analysis));

    final isSmart = analysis.isSmartMode;
    final headerLabel =
        isSmart ? 'SKIN-BASED OUTFIT INTELLIGENCE' : 'تحليل سريع للإطلالة';
    final scoreLabel =
        isSmart ? 'توافق الإطلالة مع بشرتك' : 'تقييم الإطلالة';

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'نتيجة الإطلالة'),
      body: CelebrationOnMount(
        message: AnalysisCelebration.messageForOutfit(),
        child: FloatingGradientBackground(
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: StaggeredEntrance(
                children: [
                  PremiumCard(
                    child: Column(
                      children: [
                        Text(
                          headerLabel,
                          style: AppTypography.labelSmall.copyWith(
                            color: AppColors.gold,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (analysis.styleVerdict.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            analysis.styleVerdict,
                            style: AppTypography.titleMedium,
                            textAlign: TextAlign.center,
                          ),
                        ],
                        const SizedBox(height: 16),
                        BeautyScoreRing(
                          score: analysis.compatibilityScore.toDouble(),
                          size: 130,
                          label: scoreLabel,
                        ),
                        const SizedBox(height: 12),
                        ConfidenceBadge(
                          level: analysis.confidence >= 80
                              ? 'high'
                              : analysis.confidence >= 65
                                  ? 'medium'
                                  : 'low',
                          label: 'ثقة التحليل ${analysis.confidence}%',
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'ثقة الرؤية ${analysis.visualConfidence}% · ${_sourceLabel(analysis)}',
                          style: AppTypography.labelSmall.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          analysis.explanation,
                          style: AppTypography.bodyMedium.copyWith(height: 1.5),
                          textAlign: TextAlign.center,
                        ),
                        Text(
                          'مناسبة: ${analysis.occasion.labelAr}',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (analysis.frozenImagePath != null &&
                      analysis.segmentMap != null &&
                      File(analysis.frozenImagePath!).existsSync()) ...[
                    const SizedBox(height: 16),
                    const SectionHeader(title: 'خريطة الإطلالة'),
                    PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          OutfitSegmentMapOverlay(
                            imageFile: File(analysis.frozenImagePath!),
                            segmentMap: analysis.segmentMap!,
                          ),
                          const SizedBox(height: 12),
                          _RegionColorsSection(analysis: analysis),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  if (analysis.detectedPieces.isNotEmpty ||
                      analysis.visionLabels.isNotEmpty) ...[
                    const SectionHeader(title: 'تحليل AI للإطلالة'),
                    PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (analysis.detectedPieces.isNotEmpty) ...[
                            Text('القطع المكتشفة', style: AppTypography.labelLarge),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: analysis.detectedPieces
                                  .map(
                                    (p) => Chip(
                                      label: Text(p, style: AppTypography.labelSmall),
                                      backgroundColor:
                                          AppColors.primary.withValues(alpha: 0.08),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                          if (analysis.dominantColors.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Text('ألوان AI', style: AppTypography.labelLarge),
                            const SizedBox(height: 8),
                            Text(
                              analysis.dominantColors.join(' · '),
                              style: AppTypography.bodyMedium,
                            ),
                          ],
                          if (analysis.visionLabels.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Text(
                              'إشارات Vision: ${analysis.visionLabels.take(6).join(' · ')}',
                              style: AppTypography.bodySmall.copyWith(
                                color: AppColors.textSecondary,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  const SectionHeader(title: 'تفاصيل الإطلالة'),
                  PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _row('نوع القطعة', analysis.clothingType),
                        _row('الأسلوب', analysis.styleType),
                        _row('الألوان', analysis.dominantColors.join(' · ')),
                        _row('التباين', analysis.contrastLevel),
                        _row('الرسمية', analysis.formalityLevel),
                      ],
                    ),
                  ),
                  if (analysis.matchReasons.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _ReasonSection(
                      title: 'لماذا يناسبك',
                      icon: Icons.thumb_up_outlined,
                      color: AppColors.success,
                      items: analysis.matchReasons,
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
                  if (analysis.recommendedColors.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _ChipSection(
                      title: 'ألوان بديلة مقترحة',
                      items: analysis.recommendedColors,
                      background: AppColors.goldLight.withValues(alpha: 0.35),
                    ),
                  ],
                  if (analysis.rejectedColors.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _ChipSection(
                      title: 'ألوان يُفضّل تجنّبها',
                      items: analysis.rejectedColors,
                      background: AppColors.error.withValues(alpha: 0.08),
                    ),
                  ],
                  const SizedBox(height: 16),
                  PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('إكسسوارات مقترحة', style: AppTypography.titleMedium),
                        const SizedBox(height: 8),
                        Text(
                          analysis.suggestedAccessories.join(' · '),
                          style: AppTypography.bodyMedium.copyWith(height: 1.5),
                        ),
                        if (isSmart && analysis.suggestedMakeup.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Text('مكياج مقترح', style: AppTypography.titleMedium),
                          const SizedBox(height: 8),
                          Text(
                            analysis.suggestedMakeup,
                            style: AppTypography.bodyMedium.copyWith(height: 1.5),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('تفصيل النتيجة', style: AppTypography.titleMedium),
                        const SizedBox(height: 10),
                        if (isSmart)
                          _scoreRow('توافق البشرة', analysis.skinCompatibilityScore, 40),
                        _scoreRow(
                          'ملاءمة المناسبة',
                          analysis.occasionMatchScore,
                          isSmart ? 35 : 45,
                        ),
                        _scoreRow(
                          'توازن الأسلوب',
                          analysis.styleBalanceScore,
                          isSmart ? 15 : 30,
                        ),
                        _scoreRow(
                          'انسجام الألوان',
                          analysis.colorHarmonyScore,
                          isSmart ? 10 : 25,
                        ),
                      ],
                    ),
                  ),
                  if (analysis.isQuickMode && !AnalysisSession.hasSkinReport) ...[
                    const SizedBox(height: 16),
                    PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.auto_awesome_rounded, color: AppColors.secondary),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'ارفعي الدقة مع التحليل الذكي',
                                  style: AppTypography.titleMedium,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'حلّلي بشرتك مرة واحدة — ثم استخدمي «تحليل ذكي مرتبط بالبشرة» '
                            'لربط undertone والاحمرار والتوافق اللوني.',
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.5,
                            ),
                          ),
                          const SizedBox(height: 12),
                          PremiumButton(
                            label: 'تحليل البشرة للوضع الذكي',
                            icon: Icons.face_retouching_natural_outlined,
                            variant: PremiumButtonVariant.secondary,
                            onPressed: () => AnalysisNavigation.openSkinAnalysis(context),
                          ),
                        ],
                      ),
                    ),
                  ],
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
                  if (analysis.isQuickMode) ...[
                    PremiumButton(
                      label: 'تحليل إطلالة أخرى',
                      icon: Icons.refresh_rounded,
                      variant: PremiumButtonVariant.secondary,
                      onPressed: () => AnalysisNavigation.openOutfitAnalysis(context),
                    ),
                    const SizedBox(height: 8),
                  ],
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
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: AppTypography.bodyMedium)),
          Expanded(
            child: Text(
              value,
              style: AppTypography.titleMedium.copyWith(color: AppColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _scoreRow(String label, int score, int weight) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text('$label ($weight%)', style: AppTypography.bodySmall)),
          Text('$score', style: AppTypography.titleSmall),
        ],
      ),
    );
  }

  String _sourceLabel(OutfitAnalysis analysis) {
    return switch (analysis.analysisSource) {
      'hybrid_llm' => 'Vision + LLM',
      'deterministic' => 'تحليل محلي',
      _ => analysis.analysisSource,
    };
  }
}

class _RegionColorsSection extends StatelessWidget {
  final OutfitAnalysis analysis;

  const _RegionColorsSection({required this.analysis});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (analysis.upperBodyColors.isNotEmpty)
          _colorRow('الجزء العلوي', analysis.upperBodyColors),
        if (analysis.lowerBodyColors.isNotEmpty)
          _colorRow('الجزء السفلي', analysis.lowerBodyColors),
        if (analysis.shoeColors.isNotEmpty) _colorRow('الحذاء', analysis.shoeColors),
        if (analysis.accessoryColors.isNotEmpty)
          _colorRow('الإكسسوارات', analysis.accessoryColors),
      ],
    );
  }

  Widget _colorRow(String label, List<String> colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 90, child: Text(label, style: AppTypography.bodySmall)),
          Expanded(
            child: Text(colors.join(' · '), style: AppTypography.bodyMedium),
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

class _ChipSection extends StatelessWidget {
  final String title;
  final List<String> items;
  final Color background;

  const _ChipSection({
    required this.title,
    required this.items,
    required this.background,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: AppTypography.titleMedium),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: items
              .map(
                (c) => Chip(
                  label: Text(c, style: AppTypography.labelSmall),
                  backgroundColor: background,
                  side: BorderSide.none,
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}
