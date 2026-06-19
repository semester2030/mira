import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/package_catalog.dart';
import '../../domain/entities/package_type.dart';
import '../providers/package_credit_provider.dart';

/// Mock purchase flow — credits persist locally until StoreKit consumables ship.
class PackageStoreScreen extends ConsumerStatefulWidget {
  const PackageStoreScreen({super.key});

  @override
  ConsumerState<PackageStoreScreen> createState() => _PackageStoreScreenState();
}

class _PackageStoreScreenState extends ConsumerState<PackageStoreScreen> {
  PackageType? _buying;

  Future<void> _purchase(PackageType type) async {
    setState(() => _buying = type);
    try {
      await ref.read(userPackageProvider.notifier).buyPackage(type);
      if (!mounted) return;
      final entry = PackageCatalog.of(type);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'تمت إضافة ${entry.skinCredits} بشرة و${entry.smartOutfitCredits} إطلالة ذكية ✨',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.onPrimary),
          ),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e'), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _buying = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncPkg = ref.watch(userPackageProvider);

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'باقات التحليل'),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.account_balance_wallet_outlined, size: 52, color: AppColors.secondary),
                const SizedBox(height: 12),
                Text(
                  'اشترِ رصيد التحليل',
                  style: AppTypography.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'تحليل البشرة = 1 رصيد · التحليل الذكي للإطلالة = 1 رصيد · الإطلالة السريعة مجانية',
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary, height: 1.5),
                  textAlign: TextAlign.center,
                ),
                asyncPkg.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (pkg) {
                    if (pkg == null || !pkg.isActive) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(top: 20),
                      child: PremiumCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('رصيدك الحالي', style: AppTypography.titleMedium),
                            const SizedBox(height: 10),
                            _balanceRow('بشرة', pkg.skinCredits),
                            const SizedBox(height: 6),
                            _balanceRow('إطلالة ذكية', pkg.smartOutfitCredits),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 24),
                ...PackageCatalog.all.map(
                  (entry) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: _PackageTile(
                      entry: entry,
                      loading: _buying == entry.type,
                      disabled: _buying != null && _buying != entry.type,
                      onBuy: () => _purchase(entry.type),
                    ),
                  ),
                ),
                Text(
                  'الشراء تجريبي محلياً — StoreKit consumables قريباً',
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _balanceRow(String label, int value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.bodyMedium),
        Text('$value', style: AppTypography.titleMedium.copyWith(color: AppColors.primary)),
      ],
    );
  }
}

class _PackageTile extends StatelessWidget {
  const _PackageTile({
    required this.entry,
    required this.loading,
    required this.disabled,
    required this.onBuy,
  });

  final PackageCatalogEntry entry;
  final bool loading;
  final bool disabled;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final accent = switch (entry.type) {
      PackageType.starter => AppColors.gold,
      PackageType.plus => AppColors.secondary,
      PackageType.elite => AppColors.primary,
    };

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.diamond_outlined, color: accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(entry.type.titleAr, style: AppTypography.titleLarge),
                    Text(
                      '${entry.priceSar} ر.س · ${entry.validityDays} يوم',
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...entry.benefitsAr.map(
            (b) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.check_rounded, size: 18, color: accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      b,
                      style: AppTypography.bodySmall.copyWith(height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          PremiumButton(
            label: loading ? 'جاري الشراء...' : 'شراء ${entry.type.labelAr}',
            loading: loading,
            variant: PremiumButtonVariant.gold,
            onPressed: disabled ? null : onBuy,
          ),
        ],
      ),
    );
  }
}
