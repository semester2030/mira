import 'package:flutter/material.dart';
import '../../core/navigation/app_routes.dart';
import '../theme/colors.dart';
import '../theme/typography.dart';
import 'guest_mode_icon.dart';

class GuestBanner extends StatelessWidget {
  const GuestBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardPurple.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.secondary.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const GuestModeIcon(size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('وضع الزائر', style: AppTypography.titleSmall),
                Text(
                  'تصفّحين جميع الخدمات. سجّلي دخولك برقم الجوال لحفظ تحليلاتك ونقاطك.',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.login),
            child: const Text('دخول'),
          ),
        ],
      ),
    );
  }
}
