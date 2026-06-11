import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../domain/entities/mira_beauty_report.dart';
import '../widgets/beauty_journey_section.dart';
import '../widgets/confidence_layer_section.dart';
import '../widgets/beauty_score_hero.dart';
import '../widgets/concern_narrative_section.dart';
import '../widgets/concern_zones_narrative_section.dart';
import '../widgets/face_health_map_section.dart';
import '../widgets/skin_age_comparison_card.dart';
import '../widgets/mira_report_helpers.dart';
import '../widgets/mira_tips_section.dart';
import '../widgets/progress_forecast_section.dart';
import '../widgets/treatment_plan_section.dart';
import '../widgets/weekly_plan_section.dart';
import '../../../advisor/presentation/widgets/ask_mira_section.dart';

/// Phase 2 — Premium Mira Beauty Report experience.
class MiraBeautyReportScreen extends StatefulWidget {
  final SkinReport report;
  final bool showCelebration;

  const MiraBeautyReportScreen({
    super.key,
    required this.report,
    this.showCelebration = true,
  });

  @override
  State<MiraBeautyReportScreen> createState() => _MiraBeautyReportScreenState();
}

class _MiraBeautyReportScreenState extends State<MiraBeautyReportScreen> {
  @override
  void initState() {
    super.initState();
    AnalysisSession.setSkin(widget.report);
    if (widget.showCelebration) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        AnalysisCelebration.show(
          context,
          message: AnalysisCelebration.messageForSkin(),
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
    final mira = resolveMiraReport(widget.report);
    final isGuest = AppSession.isGuest;

    return Scaffold(
      backgroundColor: AppColors.surface,
      extendBodyBehindAppBar: true,
      appBar: const MiraAppBar(pageTitle: 'تقرير ميرا'),
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
                  'تقرير شخصي من تحليلك — واضح، لطيف، وقابل للمتابعة',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 20),
                BeautyScoreHero(report: mira),
                const SizedBox(height: 16),
                BeautyJourneySection(journey: mira.beautyJourney),
                const SizedBox(height: 16),
                SkinAgeComparisonCard(
                  comparison: mira.ageComparison,
                  childSafety: mira.childSafety,
                  confidence: mira.confidenceLayer.itemFor('age_comparison'),
                ),
                if (mira.summaryAdviceAr.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _SummaryCard(text: mira.summaryAdviceAr),
                ],
                if (mira.tipsAr.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  MiraTipsSection(tips: mira.tipsAr),
                ],
                if (mira.mainConcerns.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  ConcernNarrativeSection(concerns: mira.mainConcerns),
                ],
                const SizedBox(height: 12),
                if (mira.faceHealthMap.enabled)
                  FaceHealthMapSection(map: mira.faceHealthMap)
                else if (mira.concernZonesSection.enabled)
                  ConcernZonesNarrativeSection(section: mira.concernZonesSection),
                const SizedBox(height: 20),
                TreatmentPlanSection(plan: mira.dailyRoutine),
                const SizedBox(height: 12),
                WeeklyPlanSection(plan: mira.weeklyPlan),
                const SizedBox(height: 20),
                _ProductsSection(report: widget.report, mira: mira),
                const SizedBox(height: 16),
                ProgressForecastSection(forecast: mira.progressForecast),
                const SizedBox(height: 12),
                ConfidenceLayerSection(layer: mira.confidenceLayer),
                const SizedBox(height: 20),
                AskMiraSection(report: widget.report, mira: mira),
                const SizedBox(height: 24),
                PremiumButton(
                  label: 'تفاصيل الروتين والشركاء',
                  icon: Icons.auto_awesome_rounded,
                  variant: PremiumButtonVariant.gold,
                  onPressed: () => Navigator.pushNamed(
                    context,
                    AppRoutes.skinRoutine,
                    arguments: widget.report,
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
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String text;

  const _SummaryCard({required this.text});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ملاحظات ميرا', style: AppTypography.titleMedium),
          const SizedBox(height: 8),
          Text(
            text,
            style: AppTypography.bodyMedium.copyWith(height: 1.6),
          ),
        ],
      ),
    );
  }
}

class _ProductsSection extends StatelessWidget {
  final SkinReport report;
  final MiraBeautyReport mira;

  const _ProductsSection({required this.report, required this.mira});

  String _whyRecommended(RecommendedProductSummary product) {
    if (product.stepAr != null && product.stepAr!.isNotEmpty) {
      return product.stepAr!;
    }
    final top = mira.mainConcerns.where((c) => c.severity != 'none').toList();
    if (top.isEmpty) {
      return 'مناسب لاحتياجات تقريرك العامة.';
    }
    return 'مناسب لأن تقريرك أظهر احتياجاً لـ${top.first.titleAr}.';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('منتجات تناسبك', style: AppTypography.titleMedium),
        const SizedBox(height: 4),
        Text(
          'كل توصية مرتبطة باحتياج ظهر في تحليلك',
          style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 12),
        if (mira.recommendedProducts.isNotEmpty)
          ...mira.recommendedProducts.take(3).map(
                (p) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: PremiumCard(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.shopping_bag_outlined, color: AppColors.gold),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(p.nameAr, style: AppTypography.bodyMedium),
                              if (p.partnerNameAr.isNotEmpty)
                                Text(
                                  p.partnerNameAr,
                                  style: AppTypography.labelSmall.copyWith(
                                    color: AppColors.textTertiary,
                                  ),
                                ),
                              if (p.matchScore > 0) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'تطابق ${p.matchScore}%',
                                  style: AppTypography.labelSmall.copyWith(
                                    color: AppColors.gold,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 6),
                              Text(
                                _whyRecommended(p),
                                style: AppTypography.bodySmall.copyWith(
                                  color: AppColors.textSecondary,
                                  height: 1.45,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
        else
          PremiumCard(
            child: Text(
              'سيتم عرض منتجات مناسبة عند توفر شركاء في هذا التصنيف.',
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
          ),
      ],
    );
  }
}
