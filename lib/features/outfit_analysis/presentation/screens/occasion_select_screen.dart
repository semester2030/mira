import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/navigation/analysis_navigation.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/config/mira_features.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../core/utils/mira_api_error_message.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis_mode.dart';
import '../../domain/helpers/outfit_analysis_mapper.dart';
import '../providers/outfit_intelligence_providers.dart';
import '../../../packages/presentation/providers/package_credit_provider.dart';

class OccasionSelectScreen extends ConsumerStatefulWidget {
  const OccasionSelectScreen({super.key});

  @override
  ConsumerState<OccasionSelectScreen> createState() => _OccasionSelectScreenState();
}

class _OccasionSelectScreenState extends ConsumerState<OccasionSelectScreen> {
  MiraOccasion? _selected;

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments as OutfitOccasionRouteArgs?;
    if (args == null) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'المناسبة'),
        body: const Center(child: Text('مسار غير صالح')),
      );
    }

    final skin = ref.watch(optionalSkinReportProvider);
    final isSmart = args.mode == OutfitAnalysisMode.smart;

    if (isSmart && skin == null) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'المناسبة'),
        body: EmptyState(
          icon: Icons.face_retouching_natural_outlined,
          title: 'تحليل البشرة مطلوب',
          message: 'للاستفادة من التحليل الذكي، حلّلي بشرتك أولاً',
          actionLabel: 'تحليل البشرة',
          onAction: () => AnalysisNavigation.openSkinAnalysis(context),
        ),
      );
    }

    ref.listen(outfitIntelligenceNotifierProvider, (previous, next) {
      if (next.isLoading) return;
      next.whenOrNull(
        data: (analysis) async {
          if (analysis == null) return;
          if (isSmart && MiraFeatures.packagesEnabled && !AppSession.isGuest) {
            try {
              await ref.read(userPackageProvider.notifier).consumeSmartOutfitCredit();
            } catch (e) {
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('$e'), backgroundColor: AppColors.error),
              );
              return;
            }
          }
          if (!context.mounted) return;
          final legacy = OutfitAnalysisMapper.toLegacyReport(analysis);
          AnalysisSession.setOutfitIntelligence(analysis);
          AnalysisSession.setOutfit(legacy);
          Navigator.pushReplacementNamed(
            context,
            AppRoutes.outfitResult,
            arguments: analysis,
          );
        },
        error: (error, _) {
          if (!context.mounted) return;
          ref.read(outfitIntelligenceNotifierProvider.notifier).reset();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(friendlyMiraError(error)),
              backgroundColor: AppColors.error,
              duration: const Duration(seconds: 5),
            ),
          );
        },
      );
    });

    final asyncState = ref.watch(outfitIntelligenceNotifierProvider);
    final loading = asyncState.isLoading;

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'اختيار المناسبة'),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (isSmart && skin != null)
                  PremiumCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        const Icon(Icons.link_rounded, color: AppColors.secondary, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'مرتبط ببشرتك: ${skin.skinType} · ${skin.undertone.isNotEmpty ? skin.undertone : 'undertone'}',
                            style: AppTypography.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  PremiumCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        const Icon(Icons.flash_on_rounded, color: AppColors.gold, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'تحليل سريع — ألوان وتنسيق ومناسبة فقط',
                            style: AppTypography.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 16),
                Text(
                  'لأي مناسبة هذه الإطلالة؟',
                  style: AppTypography.headlineSmall,
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: GridView.count(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.4,
                    children: MiraOccasion.values.map((o) {
                      final selected = _selected == o;
                      return PressableScale(
                        onTap: loading ? null : () => setState(() => _selected = o),
                        child: PremiumCard(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _iconFor(o),
                                color: selected ? AppColors.primary : AppColors.textSecondary,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                o.labelAr,
                                style: AppTypography.titleMedium.copyWith(
                                  color: selected ? AppColors.primary : null,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                PremiumButton(
                  label: loading ? 'جاري التحليل...' : 'تحليل الإطلالة',
                  loading: loading,
                  icon: Icons.auto_awesome_rounded,
                  variant: PremiumButtonVariant.gold,
                  onPressed: _selected != null && !loading
                      ? () {
                          ref.read(outfitIntelligenceNotifierProvider.notifier).analyze(
                                imagePath: args.imagePath,
                                occasion: _selected!,
                                mode: args.mode,
                              );
                        }
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _iconFor(MiraOccasion o) {
    switch (o) {
      case MiraOccasion.wedding:
        return Icons.favorite_border_rounded;
      case MiraOccasion.work:
        return Icons.work_outline_rounded;
      case MiraOccasion.casual:
        return Icons.weekend_outlined;
      case MiraOccasion.university:
        return Icons.school_outlined;
      case MiraOccasion.evening:
        return Icons.nightlife_outlined;
      case MiraOccasion.eid:
        return Icons.celebration_outlined;
      case MiraOccasion.interview:
        return Icons.record_voice_over_outlined;
    }
  }
}
