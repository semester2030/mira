import 'package:flutter/material.dart';
import '../../core/config/mira_features.dart';
import '../../core/constants/marketplace_copy.dart';
import '../../core/navigation/analysis_navigation.dart';
import '../../core/navigation/app_routes.dart';
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
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 20),
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
                    const MirraLogo.drawerHeader(height: 140, width: 280),
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
                  icon: Icons.face_retouching_natural_rounded,
                  title: 'تحليل البشرة',
                  onTap: () => _closeAndRun(
                    context,
                    (ctx) => AnalysisNavigation.openSkinAnalysis(ctx),
                  ),
                ),
                _MenuTile(
                  icon: Icons.checkroom_rounded,
                  title: 'تحليل الإطلالة',
                  onTap: () => _closeAndRun(
                    context,
                    (ctx) => AnalysisNavigation.openOutfitAnalysis(ctx),
                  ),
                ),
                _MenuTile(
                  icon: Icons.auto_awesome_rounded,
                  title: 'توصيات ميرا',
                  onTap: () => _closeAndRun(
                    context,
                    (ctx) => AnalysisNavigation.openRecommendations(context: ctx),
                  ),
                ),
                _MenuTile(
                  icon: Icons.explore_outlined,
                  title: 'اكتشفي — شركاء ميرا',
                  subtitle: MiraFeatures.marketplaceEnabled
                      ? null
                      : MarketplaceCopy.dashboardTeaser,
                  route: AppRoutes.discover,
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

  static void _closeAndRun(
    BuildContext drawerContext,
    Future<void> Function(BuildContext context) action,
  ) {
    Navigator.pop(drawerContext);
    AnalysisNavigation.afterDrawerClose(action);
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? route;
  final VoidCallback? onTap;

  const _MenuTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.route,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: PressableScale(
        onTap: () {
          if (onTap != null) {
            onTap!();
            return;
          }
          if (route != null) {
            Navigator.pop(context);
            AnalysisNavigation.afterDrawerClose((ctx) async {
              await Navigator.of(ctx).pushNamed(route!);
            });
          }
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTypography.titleMedium),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_left, size: 18, color: AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
