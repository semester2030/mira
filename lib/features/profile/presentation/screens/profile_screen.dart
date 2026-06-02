import 'package:flutter/material.dart';
import '../../../../core/profile/user_level.dart';
import '../../../../core/utils/saudi_phone.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../../shared/widgets/guest_mode_icon.dart';
import '../../data/datasources/profile_remote_data_source.dart';
import '../../domain/entities/profile_entity.dart';
import '../blocs/profile_bloc.dart';
import '../blocs/profile_event.dart';
import '../blocs/profile_state.dart';
import '../services/profile_service.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    if (AppSession.isGuest) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'الملف الشخصي'),
        body: FloatingGradientBackground(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const GuestBanner(),
              PremiumCard(
                child: Column(
                  children: [
                    const GuestModeIcon.profile(),
                    const SizedBox(height: 16),
                    Text('زائرة', style: AppTypography.headlineMedium),
                    Text(
                      'سجّلي دخولك برقم الجوال لحفظ ملفك وتحليلاتك',
                      style: AppTypography.bodyMedium
                          .copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    PremiumButton(
                      label: 'تسجيل الدخول',
                      onPressed: () => Navigator.pushNamed(context, AppRoutes.login),
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
      create: (_) => ProfileService.createProfileBloc(),
      child: const _ProfileScreenContent(),
    );
  }
}

class _ProfileScreenContent extends StatelessWidget {
  const _ProfileScreenContent();

  @override
  Widget build(BuildContext context) {
    final stream = ProfileRemoteDataSourceImpl().getProfileStream();

    return BlocListener<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is LoggedOut) {
          Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
        }
      },
      child: StreamBuilder<ProfileEntity>(
        stream: stream,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
            return Scaffold(
              appBar: const MiraAppBar(pageTitle: 'الملف الشخصي'),
              body: FloatingGradientBackground(
                child: const Center(child: CircularProgressIndicator()),
              ),
            );
          }
          if (snapshot.hasError) {
            return Scaffold(
              appBar: const MiraAppBar(pageTitle: 'الملف الشخصي'),
              body: EmptyState(
                icon: Icons.error_outline_rounded,
                title: 'تعذر التحميل',
                message: snapshot.error.toString(),
                actionLabel: 'إعادة المحاولة',
                onAction: () => Navigator.pushReplacementNamed(context, AppRoutes.profile),
              ),
            );
          }
          final profile = snapshot.data;
          if (profile == null) {
            return const Scaffold(
              appBar: MiraAppBar(pageTitle: 'الملف الشخصي'),
              body: Center(child: CircularProgressIndicator()),
            );
          }
          return _ProfileBody(profile: profile);
        },
      ),
    );
  }
}

class _ProfileBody extends StatelessWidget {
  final ProfileEntity profile;

  const _ProfileBody({required this.profile});

  @override
  Widget build(BuildContext context) {
    final phoneLabel = SaudiPhone.display(profile.phone);
    final levelProgress = UserLevel.progressToNext(profile.points);

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
                            value: levelProgress,
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
                              ? const Icon(Icons.person_rounded,
                                  size: 44, color: AppColors.primary)
                              : null,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(profile.name, style: AppTypography.headlineMedium),
                    if (phoneLabel.isNotEmpty)
                      Text(
                        phoneLabel,
                        style: AppTypography.bodySmall
                            .copyWith(color: AppColors.textSecondary),
                      ),
                    const SizedBox(height: 8),
                    Text(
                      '${profile.points} نقطة',
                      style: AppTypography.titleSmall.copyWith(color: AppColors.gold),
                    ),
                    const SizedBox(height: 12),
                    Chip(
                      avatar:
                          const Icon(Icons.verified_rounded, color: AppColors.gold, size: 18),
                      label: Text('المستوى: ${profile.level}'),
                      backgroundColor: AppColors.primaryLight,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _StatBox(
                      icon: Icons.analytics_outlined,
                      label: 'التحليلات',
                      value: '${profile.analyses}',
                      onTap: () => Navigator.pushNamed(context, AppRoutes.history),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _StatBox(
                      icon: Icons.tips_and_updates_outlined,
                      label: 'النصائح',
                      value: '${profile.tips}',
                      onTap: () => Navigator.pushNamed(context, AppRoutes.tips),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _StatBox(
                      icon: Icons.schedule_rounded,
                      label: 'آخر نشاط',
                      value: profile.lastActive,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              PremiumButton(
                label: 'نقاط التميز',
                variant: PremiumButtonVariant.secondary,
                icon: Icons.star_rounded,
                onPressed: () => Navigator.pushNamed(context, AppRoutes.points),
              ),
              if (profile.achievements.isNotEmpty) ...[
                const SizedBox(height: 16),
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
                label: 'تسجيل الخروج',
                variant: PremiumButtonVariant.ghost,
                onPressed: () => PremiumDialog.show(
                  context,
                  title: 'تسجيل الخروج',
                  message: 'هل أنتِ متأكدة من رغبتك في تسجيل الخروج؟',
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
  final VoidCallback? onTap;

  const _StatBox({
    required this.icon,
    required this.label,
    required this.value,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: PremiumCard(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        margin: EdgeInsets.zero,
        child: Column(
          children: [
            Icon(icon, color: AppColors.primary, size: 22),
            const SizedBox(height: 6),
            Text(value,
                style: AppTypography.titleSmall, textAlign: TextAlign.center, maxLines: 1),
            Text(label, style: AppTypography.labelSmall, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
