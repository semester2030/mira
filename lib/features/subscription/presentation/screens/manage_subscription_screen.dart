import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../../../shared/widgets/mira_app_bar.dart';

import '../../../../core/config/mira_api_config.dart';
import '../../../../core/config/mira_features.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../data/repositories/subscription_repository_impl.dart';
import '../../domain/entities/subscription_status.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class ManageSubscriptionScreen extends StatefulWidget {
  const ManageSubscriptionScreen({super.key});

  @override
  State<ManageSubscriptionScreen> createState() => _ManageSubscriptionScreenState();
}

class _ManageSubscriptionScreenState extends State<ManageSubscriptionScreen> {
  final _repo = SubscriptionRepositoryImpl();
  late Future<SubscriptionStatus> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.getStatus();
  }

  Future<void> _refresh() async {
    setState(() => _future = _repo.getStatus());
  }

  Future<void> _activateDev() async {
    await _repo.activatePremiumDev();
    if (!mounted) return;
    await _refresh();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('تم تفعيل ميرا بريميوم ✨')),
    );
  }

  String _statusAr(String status) {
    switch (status) {
      case 'active':
        return 'نشطة';
      case 'cancelled':
        return 'ملغاة';
      case 'expired':
        return 'منتهية';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'الاشتراك'),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: FutureBuilder<SubscriptionStatus>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: LoadingSkeleton(lines: 4));
              }
              if (snap.hasError) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'تعذّر تحميل بيانات الاشتراك',
                          style: AppTypography.titleMedium,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        PremiumButton(label: 'إعادة المحاولة', onPressed: _refresh),
                      ],
                    ),
                  ),
                );
              }
              final s = snap.data!;
              final subscriptionsOn = MiraFeatures.subscriptionsEnabled;

              return Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                subscriptionsOn
                                    ? (s.isPremium
                                        ? Icons.diamond_rounded
                                        : Icons.card_membership_outlined)
                                    : Icons.celebration_rounded,
                                color: subscriptionsOn
                                    ? (s.isPremium ? AppColors.gold : AppColors.primary)
                                    : AppColors.primary,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  subscriptionsOn
                                      ? (s.isPremium ? 'ميرا بريميوم ✨' : 'الخطة المجانية')
                                      : 'ميرا — مجاني بالكامل ✨',
                                  style: AppTypography.headlineSmall,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          if (!subscriptionsOn)
                            Text(
                              'كل تحليلات البشرة والإطلالة والتوصيات متاحة بلا حدود حالياً. '
                              'سنُعلمكِ عند تفعيل الاشتراكات لاحقاً.',
                              style: AppTypography.bodyMedium.copyWith(height: 1.6),
                            )
                          else ...[
                            Text(
                              'الحالة: ${_statusAr(s.status)}',
                              style: AppTypography.bodyMedium,
                            ),
                            if (s.currentPeriodEnd != null)
                              Text(
                                'تنتهي في: ${s.currentPeriodEnd!.day}/${s.currentPeriodEnd!.month}/${s.currentPeriodEnd!.year}',
                                style: AppTypography.bodySmall.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                          ],
                        ],
                      ),
                    ),
                    if (subscriptionsOn && !s.isPremium) ...[
                      const SizedBox(height: 16),
                      PremiumCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('استخدامك هذا الشهر', style: AppTypography.titleMedium),
                            const SizedBox(height: 12),
                            _usageRow(
                              'تحليلات البشرة',
                              s.usage.skinThisMonth,
                              s.usage.skinRemaining,
                            ),
                            const Divider(height: 20),
                            _usageRow(
                              'تحليلات الإطلالة',
                              s.usage.outfitThisMonth,
                              s.usage.outfitRemaining,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'الاشتراك عبر App Store قريباً. يمكنكِ معاينة ميرا بريميوم الآن.',
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 16),
                      PremiumButton(
                        label: 'ترقية إلى ميرا بريميوم',
                        icon: Icons.star_rounded,
                        variant: PremiumButtonVariant.gold,
                        onPressed: () => Navigator.pushNamed(
                          context,
                          AppRoutes.paywall,
                          arguments: s,
                        ),
                      ),
                      if (kDebugMode) ...[
                        const SizedBox(height: 10),
                        PremiumButton(
                          label: 'تفعيل بريميوم (وضع التطوير)',
                          variant: PremiumButtonVariant.secondary,
                          onPressed: _activateDev,
                        ),
                      ],
                      if (!MiraApiConfig.useBackend)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'لتفعيل الحدود من الخادم: شغّلي التطبيق مع USE_MIRA_API=true',
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                    ] else ...[
                      const SizedBox(height: 16),
                      Text(
                        'شكراً لاشتراكك — استمتعي بتحليلات بلا حدود وتوصيات كاملة.',
                        style: AppTypography.bodyLarge.copyWith(height: 1.6),
                      ),
                    ],
                    const Spacer(),
                    PremiumButton(
                      label: 'تم',
                      variant: PremiumButtonVariant.secondary,
                      onPressed: () => Navigator.pop(context),
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

  Widget _usageRow(String label, int used, int remaining) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(child: Text(label, style: AppTypography.bodyMedium)),
        Text(
          'متبقي $remaining · استُخدم $used',
          style: AppTypography.labelMedium.copyWith(color: AppColors.primary),
        ),
      ],
    );
  }
}
