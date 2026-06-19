import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/navigation/app_routes.dart';
import '../providers/package_credit_provider.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/package_type.dart';
import '../../domain/entities/user_package.dart';

/// Shows current skin + smart outfit credits in profile/settings.
class PackageCreditCard extends ConsumerWidget {
  const PackageCreditCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!MiraFeatures.packagesEnabled) {
      return const SizedBox.shrink();
    }

    final asyncPkg = ref.watch(userPackageProvider);

    return asyncPkg.when(
      loading: () => const PremiumCard(
        child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (pkg) => PremiumCard(
        onTap: () => Navigator.pushNamed(context, AppRoutes.packageStore),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.account_balance_wallet_outlined, color: AppColors.secondary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text('رصيد التحليلات', style: AppTypography.titleMedium),
                ),
                const Icon(Icons.chevron_left, size: 20, color: AppColors.textSecondary),
              ],
            ),
            const SizedBox(height: 12),
            _creditRow('Skin Credits', 'بشرة', pkg?.skinCredits ?? 0),
            const SizedBox(height: 8),
            _creditRow('Smart Outfit Credits', 'إطلالة ذكية', pkg?.smartOutfitCredits ?? 0),
            const SizedBox(height: 8),
            Text(
              _statusLine(pkg),
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 12),
            Text(
              'الإطلالة السريعة — مجانية بلا حدود',
              style: AppTypography.labelSmall.copyWith(color: AppColors.success),
            ),
          ],
        ),
      ),
    );
  }

  Widget _creditRow(String en, String ar, int value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text('$ar · $en', style: AppTypography.bodyMedium),
        Text('$value', style: AppTypography.titleMedium.copyWith(color: AppColors.primary)),
      ],
    );
  }

  String _statusLine(UserPackage? pkg) {
    if (pkg == null || !pkg.isActive) {
      return 'لا توجد باقة نشطة — اشترِ باقة للتحليل المميز';
    }
    if (pkg.isExpiredAt(DateTime.now())) {
      return 'انتهت صلاحية الباقة';
    }
    final days = pkg.expiresAt.difference(DateTime.now()).inDays;
    return '${pkg.packageType.titleAr} · تنتهي خلال $days يوم';
  }
}
