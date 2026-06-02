import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/navigation/analysis_navigation.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/gradients.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../../shared/widgets/side_menu.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../../shared/widgets/analysis_launch_card.dart';
import '../../../../core/profile/user_level.dart';
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
    final progress = UserLevel.progressToNext(points);
    final stats = [
      _StatData('التحليلات', '$analysesCount', AppColors.primary, Icons.analytics_outlined, AppRoutes.analysis),
      _StatData('النقاط', '$points', AppColors.secondary, Icons.star_rounded, AppRoutes.points),
      _StatData('النصائح', '$tipsCount', AppColors.accent, Icons.lightbulb_outline_rounded, AppRoutes.tips),
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showGuestBanner) const GuestBanner(),
          PersonalizedGreetingHeader(name: name, isGuest: showGuestBanner),
          const SizedBox(height: 24),
          _DashboardAnalysisCards(
            key: const ValueKey('mira_dashboard_analysis'),
            showGuestBanner: showGuestBanner,
            beautyScoreChild: beautyScoreChild,
            fallbackScore: beautyScore,
            progress: progress,
            points: points,
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
          PressableScale(
            onTap: () => Navigator.pushNamed(context, AppRoutes.discover),
            child: PremiumCard(
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.storefront_rounded, color: AppColors.primary),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('اكتشفي', style: AppTypography.titleMedium),
                        Text(
                          'ماركات · عيادات · صالونات حسب تحليلك',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_back_ios_new_rounded, size: 16),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
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
        appBar: AppBar(
          title: const MirraLogo.appBar(),
          centerTitle: true,
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
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
          showParticles: false,
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
      appBar: AppBar(
        title: const MirraLogo.appBar(),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
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
        showParticles: false,
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
              final tipsCount = profile?.tips ?? 0;

              return _homeBody(
                context,
                name: name,
                points: points,
                analysesCount: analysesCount,
                tipsCount: tipsCount,
                beautyScore: 0,
                showGuestBanner: false,
                beautyScoreChild: StreamBuilder<double>(
                  stream: _beautyScoreStream(),
                  builder: (context, scoreSnap) {
                    final score = scoreSnap.data ?? 0;
                    return BeautyScoreRing(
                      score: score > 0 ? score : 72,
                      size: 100,
                      label: score > 0 ? 'آخر تحليل' : 'ابدئي التحليل',
                    );
                  },
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// بطاقات التحليل — StatefulWidget مع مفتاح ثابت حتى لا تتعطّل مع تحديث Firestore.
class _DashboardAnalysisCards extends StatefulWidget {
  final bool showGuestBanner;
  final Widget? beautyScoreChild;
  final double fallbackScore;
  final double progress;
  final int points;

  const _DashboardAnalysisCards({
    super.key,
    required this.showGuestBanner,
    this.beautyScoreChild,
    required this.fallbackScore,
    required this.progress,
    required this.points,
  });

  @override
  State<_DashboardAnalysisCards> createState() => _DashboardAnalysisCardsState();
}

class _DashboardAnalysisCardsState extends State<_DashboardAnalysisCards> {
  @override
  Widget build(BuildContext context) {
    final scoreWidget = widget.beautyScoreChild ??
        BeautyScoreRing(
          score: widget.fallbackScore > 0 ? widget.fallbackScore : 72,
          size: 100,
          label: widget.fallbackScore > 0 ? 'آخر تحليل' : 'ابدئي التحليل',
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnalysisLaunchCard(
          gradient: AppGradients.primary,
          onPressed: () => AnalysisNavigation.openSkinAnalysis(context),
          child: AnalysisLaunchCardCopy(
            title: 'حلّلي بشرتك',
            subtitle: widget.showGuestBanner
                ? 'تجربة فورية — سجّلي لحفظ النتائج'
                : 'تحليل شخصي خاص — آمن وسري',
            trailing: const FaceFrameOverlay(width: 100, height: 130, compact: true),
          ),
        ),
        const SizedBox(height: 16),
        AnalysisLaunchCard(
          gradient: LinearGradient(
            colors: [
              AppColors.secondary.withValues(alpha: 0.85),
              AppColors.cardPurple.withValues(alpha: 0.9),
            ],
          ),
          onPressed: () => AnalysisNavigation.openOutfitAnalysis(context),
          padding: const EdgeInsets.all(22),
          child: AnalysisLaunchCardCopy(
            title: 'حلّلي إطلالتك',
            subtitle: 'توافق الألوان والمناسبة — خاص وآمن',
            trailing: Icon(
              Icons.checkroom_rounded,
              size: 48,
              color: AppColors.onPrimary.withValues(alpha: 0.9),
            ),
          ),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: AnalysisLaunchCard(
                color: AppColors.surface,
                padding: const EdgeInsets.all(16),
                onPressed: () => AnalysisNavigation.openSkinAnalysis(context),
                child: Center(child: scoreWidget),
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
                    AnimatedProgressBar(value: widget.progress),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        AnimatedCounter(
                          value: widget.progress * 100,
                          suffix: '% · ',
                          style: AppTypography.labelSmall.copyWith(
                            color: AppColors.textSecondary,
                          ),
                          duration: const Duration(milliseconds: 900),
                        ),
                        AnimatedCounter(
                          value: widget.points,
                          suffix: ' نقطة',
                          style: AppTypography.labelSmall.copyWith(
                            color: AppColors.textSecondary,
                          ),
                          duration: const Duration(milliseconds: 900),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
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
            AnimatedCounter(
              value: int.tryParse(data.value) ?? 0,
              style: AppTypography.headlineSmall.copyWith(color: data.color),
            ),
            Text(data.label, style: AppTypography.labelSmall),
          ],
        ),
      ),
    );
  }
}
