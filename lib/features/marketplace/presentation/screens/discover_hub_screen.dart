import 'package:flutter/material.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../widgets/marketplace_coming_soon_view.dart';

/// Hub: brands, clinics, salons — or coming-soon when marketplace is off.
class DiscoverHubScreen extends StatelessWidget {
  const DiscoverHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    if (!MiraFeatures.marketplaceEnabled) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: const MiraAppBar(pageTitle: MarketplaceCopy.hubTitle),
        body: FloatingGradientBackground(
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: const MarketplaceComingSoonView(),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const MiraAppBar(pageTitle: 'اكتشفي'),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'شركاء ميرا',
                style: AppTypography.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                'منتجات وخدمات مخصّصة حسب تحليل بشرتك — بدون حفظ صورتك.',
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 24),
              _CategoryCard(
                emoji: '💄',
                title: 'ماركات التجميل',
                subtitle: 'تسوقي من متاجر الشركاء',
                color: AppColors.cardPink,
                onTap: () => Navigator.pushNamed(
                  context,
                  AppRoutes.discoverList,
                  arguments: 'brand',
                ),
              ),
              const SizedBox(height: 12),
              _CategoryCard(
                emoji: '🏥',
                title: 'عيادات التجميل',
                subtitle: 'استشارات وعلاجات جلدية',
                color: AppColors.cardBlue,
                onTap: () => Navigator.pushNamed(
                  context,
                  AppRoutes.discoverList,
                  arguments: 'clinic',
                ),
              ),
              const SizedBox(height: 12),
              _CategoryCard(
                emoji: '💅',
                title: 'صالونات التجميل',
                subtitle: 'جلسات عناية ومكياج',
                color: AppColors.cardPurple,
                onTap: () => Navigator.pushNamed(
                  context,
                  AppRoutes.discoverList,
                  arguments: 'salon',
                ),
              ),
              const SizedBox(height: 28),
              PremiumCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('كيف يعمل؟', style: AppTypography.titleMedium),
                    const SizedBox(height: 8),
                    const Text('١. حلّلي بشرتك في ميرا'),
                    const Text('٢. نطابق احتياجاتك مع شركائنا'),
                    const Text('٣. تسوقي أو احجزي — دون مشاركة صورتك'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _CategoryCard({
    required this.emoji,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 36)),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTypography.titleLarge),
                  Text(
                    subtitle,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          ],
        ),
      ),
    );
  }
}
