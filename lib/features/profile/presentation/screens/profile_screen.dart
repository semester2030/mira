import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/profile_entity.dart';
import '../blocs/profile_bloc.dart';
import '../blocs/profile_event.dart';
import '../blocs/profile_state.dart';
import '../services/profile_service.dart';
import 'edit_profile_screen.dart';
import 'change_password_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    if (AppSession.isGuest) {
      return Scaffold(
        appBar: AppBar(title: const Text('الملف الشخصي')),
        body: FloatingGradientBackground(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const GuestBanner(),
              PremiumCard(
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: AppColors.primaryLight,
                      child: Icon(Icons.person_outline_rounded, size: 40, color: AppColors.primary),
                    ),
                    const SizedBox(height: 16),
                    Text('زائرة', style: AppTypography.headlineMedium),
                    Text(
                      'أنشئي حسابًا لحفظ ملفك وتحليلاتك',
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 20),
                    PremiumButton(
                      label: 'إنشاء حساب',
                      onPressed: () => Navigator.pushNamed(context, AppRoutes.register),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return BlocProvider(
      create: (_) => ProfileService.createProfileBloc()..add(const LoadProfile()),
      child: const _ProfileScreenContent(),
    );
  }
}

class _ProfileScreenContent extends StatelessWidget {
  const _ProfileScreenContent();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is LoggedOut) {
          Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
        }
      },
      builder: (context, state) {
        if (state is ProfileLoading) {
          return Scaffold(
            body: FloatingGradientBackground(
              child: const Center(child: CircularProgressIndicator()),
            ),
          );
        }
        if (state is ProfileError) {
          return Scaffold(
            appBar: AppBar(title: const Text('الملف الشخصي')),
            body: EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'تعذر التحميل',
              message: state.message,
              actionLabel: 'إعادة المحاولة',
              onAction: () => context.read<ProfileBloc>().add(const LoadProfile()),
            ),
          );
        }
        if (state is ProfileLoaded) {
          return _ProfileBody(profile: state.profile);
        }
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      },
    );
  }
}

class _ProfileBody extends StatelessWidget {
  final ProfileEntity profile;

  const _ProfileBody({required this.profile});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الملف الشخصي'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.pushNamed(context, AppRoutes.settings),
          ),
        ],
      ),
      body: FloatingGradientBackground(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              PremiumCard(
                child: Column(
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 110,
                          height: 110,
                          child: CircularProgressIndicator(
                            value: (profile.points / 200).clamp(0.0, 1.0),
                            strokeWidth: 5,
                            backgroundColor: AppColors.primaryLight,
                            valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                          ),
                        ),
                        CircleAvatar(
                          radius: 44,
                          backgroundImage: profile.avatarUrl != null
                              ? NetworkImage(profile.avatarUrl!)
                              : null,
                          backgroundColor: AppColors.primaryLight,
                          child: profile.avatarUrl == null
                              ? const Icon(Icons.person_rounded, size: 44, color: AppColors.primary)
                              : null,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(profile.name, style: AppTypography.headlineMedium),
                    Text(
                      profile.email,
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 12),
                    Chip(
                      avatar: const Icon(Icons.verified_rounded, color: AppColors.gold, size: 18),
                      label: Text('المستوى: ${profile.level}'),
                      backgroundColor: AppColors.primaryLight,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _StatBox(icon: Icons.analytics_outlined, label: 'التحليلات', value: '${profile.analyses}')),
                  const SizedBox(width: 8),
                  Expanded(child: _StatBox(icon: Icons.tips_and_updates_outlined, label: 'النصائح', value: '${profile.tips}')),
                  const SizedBox(width: 8),
                  Expanded(child: _StatBox(icon: Icons.schedule_rounded, label: 'آخر نشاط', value: profile.lastActive)),
                ],
              ),
              if (profile.achievements.isNotEmpty) ...[
                const SectionHeader(title: 'إنجازاتك'),
                ...profile.achievements.map(
                  (a) => PremiumCard(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.emoji_events_rounded, color: AppColors.gold),
                      title: Text(a.title, style: AppTypography.titleMedium),
                      subtitle: Text(
                        'بتاريخ: ${a.achievedAt.day}/${a.achievedAt.month}/${a.achievedAt.year}',
                        style: AppTypography.bodySmall,
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              PremiumButton(
                label: 'تعديل الملف الشخصي',
                icon: Icons.edit_outlined,
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => BlocProvider.value(
                        value: context.read<ProfileBloc>(),
                        child: EditProfileScreen(profile: profile),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 10),
              PremiumButton(
                label: 'تغيير كلمة المرور',
                variant: PremiumButtonVariant.secondary,
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => BlocProvider.value(
                        value: context.read<ProfileBloc>(),
                        child: const ChangePasswordScreen(),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 10),
              PremiumButton(
                label: 'تسجيل الخروج',
                variant: PremiumButtonVariant.ghost,
                onPressed: () => PremiumDialog.show(
                  context,
                  title: 'تسجيل الخروج',
                  message: 'هل أنت متأكدة من رغبتك في تسجيل الخروج؟',
                  confirmLabel: 'خروج',
                  cancelLabel: 'إلغاء',
                  onConfirm: () => context.read<ProfileBloc>().add(const Logout()),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _StatBox({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      margin: EdgeInsets.zero,
      child: Column(
        children: [
          Icon(icon, color: AppColors.primary, size: 22),
          const SizedBox(height: 6),
          Text(value, style: AppTypography.titleSmall, textAlign: TextAlign.center, maxLines: 1),
          Text(label, style: AppTypography.labelSmall, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
