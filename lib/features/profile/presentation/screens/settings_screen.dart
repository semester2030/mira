import 'package:flutter/material.dart';
import '../../../../core/config/mira_features.dart';
import '../../../../core/entitlements/mira_runtime_entitlement_store.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/account_deletion_service.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/services/guest_session_service.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../main.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../subscription/presentation/widgets/subscription_usage_card.dart';
import '../../../packages/presentation/widgets/package_credit_card.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _darkMode = false;
  bool _deletingAccount = false;

  Future<void> _confirmDeleteAccount(BuildContext context) async {
    final first = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف الحساب؟'),
        content: const Text(
          'سيتم حذف حسابك وبياناتك من ميرا نهائياً، بما في ذلك:\n'
          '• بيانات تسجيل الدخول\n'
          '• سجل تحليلات البشرة والإطلالة\n'
          '• الاشتراك والتفضيلات\n\n'
          'لا يمكن التراجع عن هذا الإجراء.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('متابعة', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (first != true || !context.mounted) return;

    final second = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تأكيد الحذف'),
        content: const Text('هل أنتِ متأكدة من حذف حسابك نهائياً؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('نعم، احذفي حسابي'),
          ),
        ],
      ),
    );
    if (second != true || !context.mounted) return;

    setState(() => _deletingAccount = true);
    final result = await AccountDeletionService.deleteAccount();
    if (!context.mounted) return;
    setState(() => _deletingAccount = false);

    switch (result) {
      case AccountDeletionResult.success:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تم حذف حسابك')),
        );
        Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
      case AccountDeletionResult.needsRecentLogin:
        showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('تأكيد الهوية مطلوب'),
            content: const Text(
              'لأمانك، سجّلي خروجك ثم ادخلي مجدداً برقم الجوال ورمز التحقق، '
              'ثم أعيدي محاولة حذف الحساب من الإعدادات.',
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('حسناً')),
            ],
          ),
        );
      case AccountDeletionResult.failed:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذّر حذف الحساب. حاولي لاحقاً أو تواصلي مع الدعم.')),
        );
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final mode = MirraApp.of(context)?.themeMode ?? ThemeMode.light;
    _darkMode = mode == ThemeMode.dark;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'الإعدادات'),
      body: Stack(
        children: [
          ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (AppSession.isGuest) const GuestBanner(),
          if (!AppSession.isGuest) ...[
            if (MiraFeatures.packagesEnabled) ...[
              const PackageCreditCard(),
              const SizedBox(height: 16),
            ] else if (MiraFeatures.showSubscriptionManagementUi) ...[
              const SubscriptionUsageCard(),
              const SizedBox(height: 16),
            ],
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
                if (!AppSession.isGuest && MiraFeatures.showSubscriptionManagementUi)
                  _SettingsTile(
                    icon: Icons.diamond_outlined,
                    title: 'الاشتراك',
                    subtitle: 'إدارة ميرا بريميوم',
                    onTap: () => Navigator.pushNamed(context, AppRoutes.manageSubscription),
                  ),
                if (!AppSession.isGuest && MiraFeatures.showSubscriptionManagementUi)
                  const Divider(height: 1, color: AppColors.border),
                _SettingsTile(
                  icon: Icons.notifications_outlined,
                  title: 'الإشعارات',
                  onTap: () =>
                      Navigator.pushNamed(context, AppRoutes.notificationsSettings),
                ),
                const Divider(height: 1, color: AppColors.border),
                _SettingsTile(
                  icon: Icons.lock_outline_rounded,
                  title: 'الخصوصية والأمان',
                  subtitle: 'الكاميرا للتحليل فقط — حذف الحساب من الأسفل',
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
                  onTap: () => Navigator.pushNamed(context, AppRoutes.help),
                ),
                const Divider(height: 1, color: AppColors.border),
                _SettingsTile(
                  icon: Icons.info_outline_rounded,
                  title: 'عن ميرا',
                  subtitle: 'الإصدار 1.0.0 · مرآتك الذكية الخاصة',
                  onTap: () => Navigator.pushNamed(context, AppRoutes.about),
                ),
              ],
            ),
          ),
          if (AppSession.isGuest) ...[
            const SizedBox(height: 16),
            PremiumButton(
              label: 'تسجيل الدخول برقم الجوال',
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
            PremiumCard(
              child: _SettingsTile(
                icon: Icons.delete_forever_outlined,
                title: 'حذف الحساب',
                subtitle: 'يُحذف حسابك وبياناتك نهائياً — لا يمكن التراجع',
                onTap: () => _confirmDeleteAccount(context),
              ),
            ),
            const SizedBox(height: 16),
            PremiumButton(
              label: 'تسجيل الخروج',
              variant: PremiumButtonVariant.ghost,
              onPressed: () async {
                await GuestSessionService.exit();
                MiraRuntimeEntitlementStore.clear();
                await FirebaseAuth.instance.signOut();
                if (!context.mounted) return;
                Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
              },
            ),
          ],
        ],
          ),
          if (_deletingAccount)
            Container(
              color: Colors.black26,
              child: const Center(child: CircularProgressIndicator()),
            ),
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
