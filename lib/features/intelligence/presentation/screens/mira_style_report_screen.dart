import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../outfit_analysis/domain/entities/outfit_report.dart';
import '../../domain/entities/mira_style_report.dart';
import '../widgets/mira_tips_section.dart';
import '../widgets/style_color_palette_section.dart';
import '../widgets/style_fusion_section.dart';
import '../widgets/style_insights_section.dart';
import '../widgets/style_report_helpers.dart';
import '../widgets/style_score_hero.dart';

/// Premium Mira Style Report — outfit intelligence experience.
class MiraStyleReportScreen extends StatefulWidget {
  final OutfitReport report;
  final bool showCelebration;

  const MiraStyleReportScreen({
    super.key,
    required this.report,
    this.showCelebration = true,
  });

  @override
  State<MiraStyleReportScreen> createState() => _MiraStyleReportScreenState();
}

class _MiraStyleReportScreenState extends State<MiraStyleReportScreen> {
  late OutfitReport _report;
  late MiraStyleReport _styleReport;

  @override
  void initState() {
    super.initState();
    _report = widget.report;
    _styleReport = resolveStyleReport(_report);
    AnalysisSession.setOutfit(_report);

    if (widget.showCelebration) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        AnalysisCelebration.show(
          context,
          message: AnalysisCelebration.messageForOutfit(),
        );
      });
    }
  }

  String _userName() {
    if (AppSession.isGuest) return 'زائرة';
    final user = FirebaseAuth.instance.currentUser;
    return user?.displayName?.trim().isNotEmpty == true
        ? user!.displayName!.trim()
        : 'جميلة';
  }

  @override
  Widget build(BuildContext context) {
    final fusion = resolveStyleFusion(_report, skin: AnalysisSession.lastSkin);
    final isGuest = AppSession.isGuest;

    return Scaffold(
      backgroundColor: AppColors.surface,
      extendBodyBehindAppBar: true,
      appBar: const MiraAppBar(pageTitle: 'تقرير الإطلالة'),
      body: DelightBackground(
        showParticles: false,
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            child: StaggeredEntrance(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              staggerMs: 85,
              children: [
                PersonalizedGreetingHeader(name: _userName(), isGuest: isGuest),
                const SizedBox(height: 8),
                Text(
                  'تقرير إطلالة شخصي — ألوان، مناسبة، وتماسك أسلوب',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 20),
                StyleScoreHero(report: _styleReport),
                const SizedBox(height: 16),
                StyleInsightsSection(report: _styleReport),
                const SizedBox(height: 16),
                _GarmentDetailsCard(report: _report, styleReport: _styleReport),
                const SizedBox(height: 16),
                StyleColorPaletteSection(report: _report),
                if (_styleReport.styleTipsAr.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  MiraTipsSection(tips: _styleReport.styleTipsAr),
                ],
                if (fusion != null && fusion.enabled) ...[
                  const SizedBox(height: 16),
                  StyleFusionSection(fusion: fusion, styleReport: _styleReport),
                ],
                if (_styleReport.disclaimerAr.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    _styleReport.disclaimerAr,
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.textTertiary,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
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
                      outfit: _report,
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
}

class _GarmentDetailsCard extends StatelessWidget {
  final OutfitReport report;
  final MiraStyleReport styleReport;

  const _GarmentDetailsCard({
    required this.report,
    required this.styleReport,
  });

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('تفاصيل الإطلالة', style: AppTypography.titleMedium),
          const SizedBox(height: 12),
          _row('القطعة', styleReport.garmentTypeAr.isNotEmpty ? styleReport.garmentTypeAr : report.garmentType),
          _row('الأسلوب', styleReport.styleCategoryAr.isNotEmpty ? styleReport.styleCategoryAr : report.styleCategory),
          _row('المناسبة', report.occasionLabelAr),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: AppTypography.bodyMedium),
          ),
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
