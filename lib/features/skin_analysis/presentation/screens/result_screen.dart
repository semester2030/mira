import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../marketplace/presentation/widgets/marketplace_matched_section.dart';
import '../../domain/entities/skin_report.dart';
import '../../domain/services/skin_report_matrix.dart';
import '../widgets/skin_health_radar_chart.dart';

/// Step 2 — Skin report + health matrix (no photo stored).
class ResultScreen extends StatelessWidget {
  final SkinReport report;

  const ResultScreen({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    AnalysisSession.setSkin(report);

    final radar = SkinReportMatrix.radarScores(report);
    final skinAge = SkinReportMatrix.skinAge(report);
    final overall = report.score > 0
        ? report.score.round()
        : (radar.map((e) => e.score).fold(0, (a, b) => a + b) / radar.length)
            .round();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تقرير بشرتك'),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'YOUR SKIN REPORT',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textTertiary,
                  letterSpacing: 1.2,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                'مصفوفة صحة البشرة',
                style: AppTypography.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'نوع البشرة: ${report.skinType} · عمر البشرة التقديري: $skinAge',
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Text(
                    'النتيجة العامة $overall',
                    style: AppTypography.titleMedium.copyWith(
                      color: AppColors.primaryDark,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Center(child: SkinHealthRadarChart(scores: radar)),
              const SizedBox(height: 24),
              MarketplaceMatchedSection(
                report: report,
                showServices: false,
                compactProducts: true,
              ),
              const SizedBox(height: 24),
              PremiumButton(
                label: 'اكتشفي روتين العناية',
                icon: Icons.auto_awesome_rounded,
                variant: PremiumButtonVariant.gold,
                onPressed: () => Navigator.pushNamed(
                  context,
                  AppRoutes.skinRoutine,
                  arguments: report,
                ),
              ),
              const SizedBox(height: 10),
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
    );
  }
}
