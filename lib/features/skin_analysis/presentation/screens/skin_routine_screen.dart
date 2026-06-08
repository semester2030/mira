import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../intelligence/domain/entities/mira_beauty_report.dart';
import '../../../intelligence/presentation/widgets/treatment_plan_section.dart';
import '../../../intelligence/presentation/widgets/mira_report_helpers.dart';
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
    final mira = resolveMiraReport(report);
    final skinAge = mira.skinAgeEstimate ?? SkinReportMatrix.skinAge(report);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'روتينك اليومي'),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _ProfileSummary(
                report: report,
                mira: mira,
                skinAge: skinAge,
              ),
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
              TreatmentPlanSection(plan: mira.dailyRoutine),
              const SizedBox(height: 24),
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
                      mira.summaryAdviceAr.isNotEmpty
                          ? mira.summaryAdviceAr
                          : report.advice,
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
  final MiraBeautyReport mira;
  final int skinAge;

  const _ProfileSummary({
    required this.report,
    required this.mira,
    required this.skinAge,
  });

  @override
  Widget build(BuildContext context) {
    final skinType = mira.skinTypeAr.isNotEmpty ? mira.skinTypeAr : report.skinType;

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
              Text(skinType, style: AppTypography.titleLarge),
              Text(
                mira.childSafety.isMinor
                    ? 'Skin Report · عناية مراهقة'
                    : 'Skin Report · ${skinAge > 0 ? '$skinAge سنة تقديري' : 'تحليل مخصص'}',
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
