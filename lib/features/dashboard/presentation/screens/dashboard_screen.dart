import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/gradients.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../../shared/widgets/side_menu.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../profile/domain/entities/profile_entity.dart';
import '../../../skin_analysis/presentation/widgets/face_frame_overlay.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  Stream<ProfileEntity?> _profileStream() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return Stream.value(null);

    return FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots()
        .map((doc) {
      if (!doc.exists) return null;
      return ProfileEntity.fromJson({...doc.data()!, 'id': user.uid});
    });
  }

  Stream<double> _beautyScoreStream() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return Stream.value(0);

    return FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .collection('analyses')
        .orderBy('createdAt', descending: true)
        .limit(1)
        .snapshots()
        .map((snap) {
      if (snap.docs.isEmpty) return 0.0;
      return (snap.docs.first.data()['score'] as num?)?.toDouble() ?? 0.0;
    });
  }

  Widget _homeBody(
    BuildContext context, {
    required String name,
    required int points,
    required int analysesCount,
    required int tipsCount,
    required double beautyScore,
    required bool showGuestBanner,
    Widget? beautyScoreChild,
  }) {
    final progress = (points / 200).clamp(0.0, 1.0);
    final stats = [
      _StatData('التحليلات', '$analysesCount', AppColors.primary, Icons.analytics_outlined, AppRoutes.analysis),
      _StatData('النقاط', '$points', AppColors.secondary, Icons.star_rounded, AppRoutes.points),
      _StatData('النصائح', '$tipsCount', AppColors.accent, Icons.lightbulb_outline_rounded, AppRoutes.tips),
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showGuestBanner) const GuestBanner(),
          Text('مرحبًا، $name 👋', style: AppTypography.headlineLarge),
          const SizedBox(height: 4),
          Text(
            showGuestBanner ? 'تصفّحي جميع خدمات ميرا كزائرة' : 'نتمنى لك يومًا جميلًا وبشرة مشرقة',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          PremiumCard(
            gradient: AppGradients.primary,
            onTap: () => PrivacyNavigation.openSkinAnalysis(context),
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'حلّلي بشرتك',
                        style: AppTypography.headlineMedium.copyWith(color: AppColors.onPrimary),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        showGuestBanner ? 'تجربة فورية — سجّلي لحفظ النتائج' : 'تحليل شخصي خاص — آمن وسري',
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.onPrimary.withValues(alpha: 0.9),
                        ),
                      ),
                    ],
                  ),
                ),
                const FaceFrameOverlay(width: 100, height: 130, compact: true),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PremiumCard(
            gradient: LinearGradient(
              colors: [
                AppColors.secondary.withValues(alpha: 0.85),
                AppColors.cardPurple.withValues(alpha: 0.9),
              ],
            ),
            onTap: () => PrivacyNavigation.openOutfitAnalysis(context),
            padding: const EdgeInsets.all(22),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'حلّلي إطلالتك',
                        style: AppTypography.headlineMedium.copyWith(color: AppColors.onPrimary),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'توافق الألوان والمناسبة — خاص وآمن',
                        style: AppTypography.bodyMedium.copyWith(
                          color: AppColors.onPrimary.withValues(alpha: 0.9),
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.checkroom_rounded, size: 48, color: AppColors.onPrimary.withValues(alpha: 0.9)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: PremiumCard(
                  child: beautyScoreChild ??
                      BeautyScoreRing(
                        score: beautyScore > 0 ? beautyScore : 72,
                        size: 100,
                        label: beautyScore > 0 ? 'آخر تحليل' : 'ابدئي التحليل',
                      ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('تقدمك', style: AppTypography.titleMedium),
                      const SizedBox(height: 12),
                      AnimatedProgressBar(value: progress),
                      const SizedBox(height: 8),
                      Text(
                        '${(progress * 100).round()}% · $points نقطة',
                        style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const SectionHeader(title: 'نظرة سريعة'),
          SizedBox(
            height: 130,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: stats.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, i) => _StatCard(data: stats[i]),
            ),
          ),
          const SizedBox(height: 24),
          PremiumCard(
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.tips_and_updates_rounded, color: AppColors.primary),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Text(
                    '✨ نصيحة اليوم: احرصي على شرب الماء وواقي الشمس يوميًا لبشرة أكثر إشراقًا.',
                    style: TextStyle(height: 1.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!AppSession.canBrowse) {
      return Scaffold(
        body: FloatingGradientBackground(
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: EmptyState(
                icon: Icons.lock_outline_rounded,
                title: 'سجّلي دخولك للمتابعة',
                message: 'أو تصفّحي كزائرة لاستكشاف جميع خدمات ميرا دون حساب.',
                actionLabel: 'تسجيل الدخول',
                onAction: () => Navigator.pushReplacementNamed(context, AppRoutes.login),
              ),
            ),
          ),
        ),
      );
    }

    if (AppSession.isGuest) {
      return Scaffold(
        extendBodyBehindAppBar: true,
        appBar: AppBar(
          title: const MirraLogo.small(),
          actions: [
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              onPressed: () => Navigator.pushNamed(context, AppRoutes.settings),
            ),
            Builder(
              builder: (ctx) => IconButton(
                icon: const Icon(Icons.menu_rounded),
                onPressed: () => Scaffold.of(ctx).openEndDrawer(),
              ),
            ),
          ],
        ),
        endDrawer: const SideMenu(),
        body: FloatingGradientBackground(
          child: SafeArea(
            child: _homeBody(
              context,
              name: 'زائرة',
              points: 0,
              analysesCount: 0,
              tipsCount: 5,
              beautyScore: 72,
              showGuestBanner: true,
            ),
          ),
        ),
      );
    }

    final user = FirebaseAuth.instance.currentUser!;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const MirraLogo.small(),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.pushNamed(context, AppRoutes.settings),
          ),
          Builder(
            builder: (ctx) => IconButton(
              icon: const Icon(Icons.menu_rounded),
              onPressed: () => Scaffold.of(ctx).openEndDrawer(),
            ),
          ),
        ],
      ),
      endDrawer: const SideMenu(),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: StreamBuilder<ProfileEntity?>(
            stream: _profileStream(),
            builder: (context, profileSnap) {
              if (profileSnap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              final profile = profileSnap.data;
              final name = profile?.name ?? user.displayName ?? 'ميرا';
              final points = profile?.points ?? 0;
              final analysesCount = profile?.analyses ?? 0;
              final progress = (points / 200).clamp(0.0, 1.0);

              final stats = [
                _StatData('التحليلات', '$analysesCount', AppColors.primary, Icons.analytics_outlined, AppRoutes.analysis),
                _StatData('النقاط', '$points', AppColors.secondary, Icons.star_rounded, AppRoutes.points),
                _StatData('النصائح', '${profile?.tips ?? 0}', AppColors.accent, Icons.lightbulb_outline_rounded, AppRoutes.tips),
              ];

              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('مرحبًا، $name 👋', style: AppTypography.headlineLarge),
                    const SizedBox(height: 4),
                    Text(
                      'نتمنى لك يومًا جميلًا وبشرة مشرقة',
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 24),
                    PremiumCard(
                      gradient: AppGradients.primary,
                      onTap: () => PrivacyNavigation.openSkinAnalysis(context),
                      padding: const EdgeInsets.all(24),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'حلّلي بشرتك',
                                  style: AppTypography.headlineMedium.copyWith(color: AppColors.onPrimary),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'تحليل شخصي خاص — آمن وسري',
                                  style: AppTypography.bodyMedium.copyWith(
                                    color: AppColors.onPrimary.withValues(alpha: 0.9),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const FaceFrameOverlay(width: 100, height: 130, compact: true),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    PremiumCard(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.secondary.withValues(alpha: 0.85),
                          AppColors.cardPurple.withValues(alpha: 0.9),
                        ],
                      ),
                      onTap: () => PrivacyNavigation.openOutfitAnalysis(context),
                      padding: const EdgeInsets.all(22),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'حلّلي إطلالتك',
                                  style: AppTypography.headlineMedium.copyWith(color: AppColors.onPrimary),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'توافق الألوان والمناسبة — خاص وآمن',
                                  style: AppTypography.bodyMedium.copyWith(
                                    color: AppColors.onPrimary.withValues(alpha: 0.9),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.checkroom_rounded, size: 48, color: AppColors.onPrimary.withValues(alpha: 0.9)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: StreamBuilder<double>(
                            stream: _beautyScoreStream(),
                            builder: (context, scoreSnap) {
                              final score = scoreSnap.data ?? 0;
                              return PremiumCard(
                                child: BeautyScoreRing(
                                  score: score > 0 ? score : 72,
                                  size: 100,
                                  label: score > 0 ? 'آخر تحليل' : 'ابدئي التحليل',
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: PremiumCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('تقدمك', style: AppTypography.titleMedium),
                                const SizedBox(height: 12),
                                AnimatedProgressBar(value: progress),
                                const SizedBox(height: 8),
                                Text(
                                  '${(progress * 100).round()}% · $points نقطة',
                                  style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    const SectionHeader(title: 'نظرة سريعة'),
                    SizedBox(
                      height: 130,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: stats.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (context, i) => _StatCard(data: stats[i]),
                      ),
                    ),
                    const SizedBox(height: 24),
                    PremiumCard(
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.accent.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.tips_and_updates_rounded, color: AppColors.primary),
                          ),
                          const SizedBox(width: 16),
                          const Expanded(
                            child: Text(
                              '✨ نصيحة اليوم: احرصي على شرب الماء وواقي الشمس يوميًا لبشرة أكثر إشراقًا.',
                              style: TextStyle(height: 1.5),
                            ),
                          ),
                        ],
                      ),
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
}

class _StatData {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  final String route;
  const _StatData(this.label, this.value, this.color, this.icon, this.route);
}

class _StatCard extends StatelessWidget {
  final _StatData data;
  const _StatCard({required this.data});

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () => Navigator.pushNamed(context, data.route),
      child: Container(
        width: 120,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: data.color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: data.color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(data.icon, color: data.color, size: 24),
            const Spacer(),
            Text(data.value, style: AppTypography.headlineSmall.copyWith(color: data.color)),
            Text(data.label, style: AppTypography.labelSmall),
          ],
        ),
      ),
    );
  }
}
