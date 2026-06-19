import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/navigation/analysis_navigation.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis_mode.dart';
import '../providers/outfit_intelligence_providers.dart';
import '../../../packages/presentation/providers/package_credit_provider.dart';

/// Entry hub — Quick vs Smart outfit analysis modes.
class OutfitUploadScreen extends ConsumerWidget {
  const OutfitUploadScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!AppSession.canBrowse) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'تحليل الإطلالة'),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'تسجيل الدخول مطلوب',
          message: 'سجّلي دخولك لتحليل إطلالتك بشكل خاص',
          actionLabel: 'تسجيل الدخول',
          onAction: () => Navigator.pushNamed(context, AppRoutes.login),
        ),
      );
    }

    final hasSkin = AnalysisSession.hasSkinReport;

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'تحليل الإطلالة'),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (AppSession.isGuest) const GuestBanner(),
                Text(
                  'اختر نوع التحليل',
                  style: AppTypography.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'حلّلي إطلالتك عدة مرات يومياً — التحليل الذكي يضيف ربطاً ببشرتك',
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
                if (hasSkin) ...[
                  const SizedBox(height: 16),
                  PremiumCard(
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle_outline, color: AppColors.secondary),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'بشرتك جاهزة للتحليل الذكي',
                            style: AppTypography.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                _ModeCard(
                  title: 'تحليل سريع للإطلالة',
                  subtitle: 'تحليل الألوان والتنسيق والمناسبة',
                  icon: Icons.flash_on_rounded,
                  accent: AppColors.gold,
                  onTap: () => _start(context, ref, OutfitAnalysisMode.quick),
                ),
                const SizedBox(height: 12),
                _ModeCard(
                  title: 'تحليل ذكي مرتبط بالبشرة',
                  subtitle: 'دقة أعلى وربط مباشر مع بشرتك',
                  icon: Icons.auto_awesome_rounded,
                  accent: AppColors.secondary,
                  onTap: () => _startSmart(context, ref, hasSkin),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _start(
    BuildContext context,
    WidgetRef ref,
    OutfitAnalysisMode mode,
  ) async {
    await ref.read(outfitAnalysisModeProvider.notifier).select(mode);
    if (!context.mounted) return;
    await Navigator.pushNamed(
      context,
      AppRoutes.outfitLiveCapture,
      arguments: OutfitLiveCaptureRouteArgs(mode: mode),
    );
  }

  Future<void> _startSmart(
    BuildContext context,
    WidgetRef ref,
    bool hasSkin,
  ) async {
    if (!hasSkin) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'للاستفادة من التحليل الذكي، حلّلي بشرتك أولاً',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
          ),
          backgroundColor: AppColors.primary,
        ),
      );
      await AnalysisNavigation.openSkinAnalysis(context);
      return;
    }
    if (!await PackageCreditGate.ensureSmartOutfitCredits(context, ref)) return;
    if (!context.mounted) return;
    await _start(context, ref, OutfitAnalysisMode.smart);
  }
}

class _ModeCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color accent;
  final VoidCallback onTap;

  const _ModeCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: PremiumCard(
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: accent, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTypography.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: accent),
          ],
        ),
      ),
    );
  }
}
