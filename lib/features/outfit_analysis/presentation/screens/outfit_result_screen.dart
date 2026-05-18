import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../core/session/analysis_session.dart';
import '../../domain/entities/outfit_report.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class OutfitResultScreen extends StatelessWidget {
  final OutfitReport report;

  const OutfitResultScreen({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('نتيجة الإطلالة')),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                PremiumCard(
                  child: Column(
                    children: [
                      BeautyScoreRing(
                        score: report.compatibilityScore,
                        size: 120,
                        label: 'توافق الإطلالة',
                      ),
                      const SizedBox(height: 8),
                      Text(
                        report.occasionSuitability,
                        style: AppTypography.titleMedium,
                        textAlign: TextAlign.center,
                      ),
                      Text(
                        'مناسبة: ${report.occasionLabelAr}',
                        style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionHeader(title: 'تفاصيل الإطلالة'),
                PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _row('نوع القطعة', report.garmentType),
                      _row('الأسلوب', report.styleCategory),
                      _row('الألوان', report.dominantColors.join(' · ')),
                      if (report.alternativeColors.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'ألوان بديلة: ${report.alternativeColors.join('، ')}',
                            style: AppTypography.bodyMedium,
                          ),
                        ),
                    ],
                  ),
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
                      outfit: report,
                    ),
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
}
