import 'package:flutter/material.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../core/session/analysis_session.dart';
import '../../domain/entities/skin_report.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../widgets/skin_condition_indicator.dart';

class ResultScreen extends StatelessWidget {
  final SkinReport report;

  const ResultScreen({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    AnalysisSession.setSkin(report);
    final score = report.score > 0
        ? report.score
        : ((report.hydration + (100 - report.oiliness)) / 2).clamp(0, 100).toDouble();

    return Scaffold(
      appBar: AppBar(title: const Text('نتيجة التحليل')),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                PremiumCard(
                  child: Column(
                    children: [
                      BeautyScoreRing(score: score, size: 130),
                      const SizedBox(height: 8),
                      Text(
                        'نوع البشرة: ${report.skinType}',
                        style: AppTypography.titleLarge,
                      ),
                      if (report.undertone.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          'النغمة: ${report.undertone} · لون البشرة: ${report.skinTone}',
                          style: AppTypography.bodyMedium.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                PremiumCard(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      SkinConditionIndicator(
                        label: 'الترطيب',
                        value: report.hydration,
                        color: AppColors.primary,
                      ),
                      SkinConditionIndicator(
                        label: 'الدهون',
                        value: report.oiliness,
                        color: AppColors.secondary,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionHeader(title: 'تفاصيل التحليل'),
                PremiumCard(
                  child: Column(
                    children: [
                      _row('التجاعيد', '${report.wrinkles}'),
                      _row('البقع', '${report.spots}'),
                      _row('المسام', '${report.pores}'),
                      if (report.acne > 0) _row('حب الشباب', '${report.acne}'),
                      if (report.redness > 0) _row('الاحمرار', '${report.redness}'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                PremiumCard(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.cardPink,
                      AppColors.cardPurple.withValues(alpha: 0.5),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('توصية ميرا', style: AppTypography.headlineSmall),
                      const SizedBox(height: 8),
                      Text(
                        report.advice,
                        style: AppTypography.bodyLarge.copyWith(height: 1.6),
                      ),
                      if (report.recommendations.length > 1) ...[
                        const SizedBox(height: 12),
                        ...report.recommendations.skip(1).map(
                              (r) => Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(
                                  '• $r',
                                  style: AppTypography.bodyMedium,
                                ),
                              ),
                            ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                PremiumButton(
                  label: 'توصيات ميرا الكاملة',
                  icon: Icons.auto_awesome_rounded,
                  variant: PremiumButtonVariant.gold,
                  onPressed: () => PrivacyNavigation.openRecommendations(
                    context,
                    skin: report,
                  ),
                ),
                const SizedBox(height: 8),
                PremiumButton(
                  label: 'تحليل إطلالتي',
                  variant: PremiumButtonVariant.secondary,
                  onPressed: () => PrivacyNavigation.openOutfitAnalysis(context),
                ),
                const SizedBox(height: 8),
                PremiumButton(
                  label: 'العودة للرئيسية',
                  variant: PremiumButtonVariant.ghost,
                  onPressed: () => Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.dashboard,
                    (route) => false,
                  ),
                ),
              ],
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
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTypography.bodyMedium),
          Text(
            value,
            style: AppTypography.titleMedium.copyWith(color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}
