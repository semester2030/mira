import 'package:flutter/material.dart';
import '../../../../shared/widgets/mira_app_bar.dart';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/ai/models/mira_recommendation.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/usecases/build_mira_recommendation_usecase.dart';
import '../widgets/makeup_section.dart';
import '../widgets/styling_section.dart';

class RecommendationsScreen extends StatefulWidget {
  const RecommendationsScreen({super.key});

  @override
  State<RecommendationsScreen> createState() => _RecommendationsScreenState();
}

class _RecommendationsScreenState extends State<RecommendationsScreen> {
  late final BuildMiraRecommendationUseCase _useCase;
  Future<MiraRecommendation>? _future;

  @override
  void initState() {
    super.initState();
    _useCase = BuildMiraRecommendationUseCase();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  void _load() {
    final args = ModalRoute.of(context)?.settings.arguments as RecommendationRouteArgs?;
    final skin = args?.skin ?? AnalysisSession.lastSkin;
    final outfit = args?.outfit ?? AnalysisSession.lastOutfit;

    if (skin == null) {
      setState(() => _future = Future.error(Exception('أجري تحليل البشرة أولاً')));
      return;
    }

    setState(() {
      _future = _useCase.fromReports(
        skinReport: skin,
        outfitReport: outfit,
        occasion: outfit != null ? MiraOccasion.fromId(outfit.occasionId) : null,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'توصيات ميرا'),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: FutureBuilder<MiraRecommendation>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.all(20),
                  child: LoadingSkeleton(lines: 6),
                );
              }
              if (snap.hasError || !snap.hasData) {
                return EmptyState(
                  icon: Icons.spa_outlined,
                  title: 'تحليل البشرة مطلوب',
                  message: snap.error?.toString() ?? 'أجري تحليل البشرة ثم الإطلالة للحصول على توصيات كاملة.',
                  actionLabel: 'تحليل البشرة',
                  onAction: () => Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.dashboard,
                    (_) => false,
                  ),
                );
              }

              final rec = snap.data!;
              return SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                          Text('ملخص ميرا', style: AppTypography.headlineSmall),
                          const SizedBox(height: 10),
                          Text(
                            rec.summary.ar,
                            style: AppTypography.bodyLarge.copyWith(height: 1.6),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const SectionHeader(title: 'البشرة'),
                    PremiumCard(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          BeautyScoreRing(score: rec.skin.beautyScore, size: 90, label: 'الجمال'),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(rec.skin.skinTypeAr, style: AppTypography.titleLarge),
                              Text(
                                '${rec.skin.undertoneAr} · ${rec.skin.skinToneAr}',
                                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (rec.outfit != null) ...[
                      const SizedBox(height: 16),
                      const SectionHeader(title: 'الإطلالة'),
                      PremiumCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'توافق ${rec.outfit!.compatibilityScore.round()}% · ${rec.outfit!.garmentTypeAr}',
                              style: AppTypography.titleMedium,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              rec.outfit!.dominantColors.join(' · '),
                              style: AppTypography.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    MakeupSection(makeup: rec.makeup),
                    const SizedBox(height: 16),
                    StylingSection(styling: rec.styling),
                    const SizedBox(height: 24),
                    PremiumButton(
                      label: 'العودة للرئيسية',
                      onPressed: () => Navigator.pushNamedAndRemoveUntil(
                        context,
                        AppRoutes.dashboard,
                        (_) => false,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
