import 'package:flutter/material.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/privacy/privacy_navigation.dart';
import '../theme/colors.dart';
import '../theme/gradients.dart';
import '../theme/typography.dart';
import 'mirra_logo.dart';
import 'premium/pressable_scale.dart';

class SideMenu extends StatelessWidget {
  const SideMenu({super.key});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: AppColors.background,
      child: Column(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: AppGradients.primary,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(24),
              ),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close_rounded, color: AppColors.onPrimary),
                        ),
                      ],
                    ),
                    const MirraLogo.medium(),
                    const SizedBox(height: 16),
                    Text(
                      'مرحبًا، ميرا',
                      style: AppTypography.titleLarge.copyWith(color: AppColors.onPrimary),
                    ),
                    Text(
                      'رفيقتك الخاصة في العناية',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.onPrimary.withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _MenuTile(
                  icon: Icons.add_chart_rounded,
                  title: 'تحليل البشرة',
                  onTap: () => PrivacyNavigation.openSkinAnalysis(context),
                ),
                _MenuTile(
                  icon: Icons.checkroom_outlined,
                  title: 'تحليل الإطلالة',
                  onTap: () => PrivacyNavigation.openOutfitAnalysis(context),
                ),
                _MenuTile(
                  icon: Icons.auto_awesome_rounded,
                  title: 'توصيات ميرا',
                  onTap: () => PrivacyNavigation.openRecommendations(context),
                ),
                _MenuTile(icon: Icons.history_rounded, title: 'سجل تحليل البشرة', route: AppRoutes.history),
                _MenuTile(icon: Icons.inventory_2_outlined, title: 'سجل الإطلالات', route: AppRoutes.outfitHistory),
                _MenuTile(icon: Icons.tips_and_updates_outlined, title: 'نصائح العناية', route: AppRoutes.tips),
                _MenuTile(icon: Icons.person_outline_rounded, title: 'الملف الشخصي', route: AppRoutes.profile),
                _MenuTile(icon: Icons.star_rounded, title: 'نقاط التميز', route: AppRoutes.points),
                _MenuTile(icon: Icons.settings_outlined, title: 'الإعدادات', route: AppRoutes.settings),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? route;
  final VoidCallback? onTap;

  const _MenuTile({
    required this.icon,
    required this.title,
    this.route,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: PressableScale(
        onTap: () {
          Navigator.pop(context);
          if (onTap != null) {
            onTap!();
          } else if (route != null) {
            Navigator.pushNamed(context, route!);
          }
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.primaryLight.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 22),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: AppTypography.titleMedium)),
              const Icon(Icons.chevron_left, size: 18, color: AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
