import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../marketplace/presentation/widgets/marketplace_matched_section.dart';
import '../../domain/entities/skin_report.dart';
import '../../domain/services/skin_report_matrix.dart';

/// Step 3 — Daily routine + partner recommendations (no photo).
class SkinRoutineScreen extends StatelessWidget {
  final SkinReport report;

  const SkinRoutineScreen({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    AnalysisSession.setSkin(report);
    final isGuest = AppSession.isGuest;
    final skinAge = SkinReportMatrix.skinAge(report);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'روتينك اليومي'),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _ProfileSummary(report: report, skinAge: skinAge),
              const SizedBox(height: 20),
              PremiumButton(
                label: isGuest ? 'تم — النتيجة للعرض فقط' : 'حفظ النتيجة',
                icon: Icons.bookmark_rounded,
                variant: PremiumButtonVariant.gold,
                onPressed: () => _saveResult(context, isGuest),
              ),
              if (isGuest) ...[
                const SizedBox(height: 8),
                Text(
                  'سجّلي دخولك لحفظ التحليلات في سجلّك — لا نحفظ صورتك.',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 28),
              Text(
                'Recommended Routines',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textTertiary,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 4),
              Text('الروتين والشركاء', style: AppTypography.headlineSmall),
              const SizedBox(height: 16),
              MarketplaceMatchedSection(
                report: report,
                showServices: true,
                compactProducts: false,
              ),
              const SizedBox(height: 16),
              PremiumCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('نصيحة ميرا', style: AppTypography.titleMedium),
                    const SizedBox(height: 8),
                    Text(
                      report.advice,
                      style: AppTypography.bodyMedium.copyWith(height: 1.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              PremiumButton(
                label: 'العودة للرئيسية',
                variant: PremiumButtonVariant.secondary,
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

  void _saveResult(BuildContext context, bool isGuest) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          isGuest
              ? 'تم عرض الروتين. سجّلي لحفظ التحليلات.'
              : 'تم حفظ نتيجة التحليل ✨ (بدون صورة)',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
        ),
        backgroundColor: AppColors.success,
      ),
    );
    if (!isGuest) {
      Future.delayed(const Duration(milliseconds: 600), () {
        if (context.mounted) {
          Navigator.pushNamedAndRemoveUntil(
            context,
            AppRoutes.dashboard,
            (route) => false,
          );
        }
      });
    }
  }
}

class _ProfileSummary extends StatelessWidget {
  final SkinReport report;
  final int skinAge;

  const _ProfileSummary({required this.report, required this.skinAge});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 28,
          backgroundColor: AppColors.primaryLight,
          child: Icon(Icons.face_retouching_natural_rounded, color: AppColors.primary),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(report.skinType, style: AppTypography.titleLarge),
              Text(
                'Skin Report · $skinAge سنة تقديري',
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
