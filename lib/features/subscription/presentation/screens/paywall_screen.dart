import 'package:flutter/material.dart';
import '../../../../shared/widgets/mira_app_bar.dart';

import '../../../../core/analytics/mira_analytics.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../domain/entities/subscription_status.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class PaywallScreen extends StatelessWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context) {
    MiraAnalytics.subscriptionViewed();
    final status = ModalRoute.of(context)?.settings.arguments as SubscriptionStatus?;

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'ميرا بريميوم'),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.diamond_outlined, size: 56, color: AppColors.secondary),
                const SizedBox(height: 12),
                Text(
                  'ارتقِ بتجربتك',
                  style: AppTypography.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'تحليلات بلا حدود + توصيات كاملة',
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                  textAlign: TextAlign.center,
                ),
                if (status != null) ...[
                  const SizedBox(height: 16),
                  PremiumCard(
                    child: Column(
                      children: [
                        _usageRow(
                          'تحليلات البشرة المتبقية',
                          '${status.usage.skinRemaining}',
                        ),
                        _usageRow(
                          'تحليلات الإطلالة المتبقية',
                          '${status.usage.outfitRemaining}',
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ميرا بريميوم', style: AppTypography.headlineSmall),
                      const SizedBox(height: 12),
                      _benefit('تحليل بشرة وإطلالة بدون حدود'),
                      _benefit('توصيات مكياج وإكسسوارات كاملة'),
                      _benefit('أولوية في التحليل بالذكاء الاصطناعي'),
                      _benefit('خصوصية تامة — لا نحتفظ بصورك'),
                      const SizedBox(height: 12),
                      Text(
                        '٣٩ ريال / شهر',
                        style: AppTypography.titleLarge.copyWith(color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                PremiumButton(
                  label: 'اشتركي في ميرا بريميوم',
                  icon: Icons.star_rounded,
                  variant: PremiumButtonVariant.gold,
                  onPressed: () {
                    MiraAnalytics.subscriptionStarted();
                    Navigator.pushNamed(context, AppRoutes.manageSubscription);
                  },
                ),
                const SizedBox(height: 8),
                PremiumButton(
                  label: 'ليس الآن',
                  variant: PremiumButtonVariant.ghost,
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _benefit(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline, color: AppColors.success, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: AppTypography.bodyLarge)),
        ],
      ),
    );
  }

  Widget _usageRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTypography.bodyMedium),
          Text(value, style: AppTypography.titleMedium),
        ],
      ),
    );
  }
}
