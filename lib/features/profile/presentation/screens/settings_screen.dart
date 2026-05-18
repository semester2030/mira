import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/services/guest_session_service.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../main.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../subscription/presentation/widgets/subscription_usage_card.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _darkMode = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final mode = MirraApp.of(context)?.themeMode ?? ThemeMode.light;
    _darkMode = mode == ThemeMode.dark;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (AppSession.isGuest) const GuestBanner(),
          if (!AppSession.isGuest) ...[
            const SubscriptionUsageCard(),
            const SizedBox(height: 16),
          ],
          PremiumCard(
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('الوضع الليلي', style: AppTypography.titleMedium),
                  subtitle: Text(
                    'مظهر هادئ ومريح للعين',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                  value: _darkMode,
                  activeThumbColor: AppColors.primary,
                  onChanged: (v) {
                    setState(() => _darkMode = v);
                    MirraApp.of(context)?.setThemeMode(v ? ThemeMode.dark : ThemeMode.light);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PremiumCard(
            child: Column(
              children: [
                _SettingsTile(
                  icon: Icons.person_outline_rounded,
                  title: 'الملف الشخصي',
                  onTap: () => Navigator.pushNamed(context, AppRoutes.profile),
                ),
                const Divider(height: 1, color: AppColors.border),
                if (!AppSession.isGuest)
                  _SettingsTile(
                    icon: Icons.diamond_outlined,
                    title: 'الاشتراك',
                    subtitle: 'إدارة ميرا بريميوم',
                    onTap: () => Navigator.pushNamed(context, AppRoutes.manageSubscription),
                  ),
                if (!AppSession.isGuest)
                  const Divider(height: 1, color: AppColors.border),
                _SettingsTile(
                  icon: Icons.notifications_outlined,
                  title: 'الإشعارات',
                  onTap: () {},
                ),
                const Divider(height: 1, color: AppColors.border),
                _SettingsTile(
                  icon: Icons.lock_outline_rounded,
                  title: 'الخصوصية والأمان',
                  subtitle: 'لا نحتفظ بصورك — اقرئي السياسة',
                  onTap: () => Navigator.pushNamed(context, AppRoutes.privacyPolicy),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PremiumCard(
            child: Column(
              children: [
                _SettingsTile(
                  icon: Icons.rate_review_outlined,
                  title: 'قيّمي التطبيق',
                  onTap: () => Navigator.pushNamed(context, AppRoutes.feedback),
                ),
                const Divider(height: 1, color: AppColors.border),
                _SettingsTile(
                  icon: Icons.help_outline_rounded,
                  title: 'المساعدة',
                  onTap: () {},
                ),
                const Divider(height: 1, color: AppColors.border),
                _SettingsTile(
                  icon: Icons.info_outline_rounded,
                  title: 'عن ميرا',
                  subtitle: 'الإصدار 1.0.0 · مرآتك الذكية الخاصة',
                  onTap: () {},
                ),
              ],
            ),
          ),
          if (AppSession.isGuest) ...[
            const SizedBox(height: 16),
            PremiumButton(
              label: 'إنشاء حساب',
              onPressed: () => Navigator.pushNamed(context, AppRoutes.register),
            ),
            const SizedBox(height: 8),
            PremiumButton(
              label: 'تسجيل الدخول',
              variant: PremiumButtonVariant.secondary,
              onPressed: () => Navigator.pushNamed(context, AppRoutes.login),
            ),
            const SizedBox(height: 8),
            PremiumButton(
              label: 'إنهاء وضع الزائر',
              variant: PremiumButtonVariant.ghost,
              onPressed: () async {
                await GuestSessionService.exit();
                if (!context.mounted) return;
                Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
              },
            ),
          ] else if (FirebaseAuth.instance.currentUser != null) ...[
            const SizedBox(height: 16),
            PremiumButton(
              label: 'تسجيل الخروج',
              variant: PremiumButtonVariant.ghost,
              onPressed: () async {
                await GuestSessionService.exit();
                await FirebaseAuth.instance.signOut();
                if (!context.mounted) return;
                Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: AppColors.primary),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTypography.titleMedium),
                  if (subtitle != null)
                    Text(
                      subtitle!,
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                    ),
                ],
              ),
            ),
            const Icon(Icons.chevron_left, color: AppColors.textSecondary, size: 20),
          ],
        ),
      ),
    );
  }
}
