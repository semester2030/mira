import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../profile/domain/entities/profile_entity.dart';

class PointsScreen extends StatelessWidget {
  const PointsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    if (AppSession.isGuest) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'نقاط التميز'),
        body: FloatingGradientBackground(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const GuestBanner(),
              PremiumCard(
                child: Column(
                  children: [
                    Text('0', style: AppTypography.displayLarge.copyWith(color: AppColors.gold)),
                    Text('نقطة — وضع الزائر', style: AppTypography.titleMedium),
                    const SizedBox(height: 12),
                    Text(
                      'سجّلي حسابًا لجمع النقاط مع كل تحليل (+15 نقطة).',
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'نقاط التميز'),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'تسجيل الدخول مطلوب',
          message: 'سجّلي دخولك لعرض نقاطك ومكافآتك.',
          actionLabel: 'تسجيل الدخول',
          onAction: () => Navigator.pushNamed(context, AppRoutes.login),
        ),
      );
    }

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'نقاط التميز'),
      body: FloatingGradientBackground(
        child: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance.collection('users').doc(user.uid).snapshots(),
          builder: (context, snap) {
            if (!snap.hasData) {
              return const Center(child: CircularProgressIndicator());
            }

            ProfileEntity? profile;
            if (snap.data!.exists) {
              profile = ProfileEntity.fromJson({...snap.data!.data()!, 'id': user.uid});
            }

            final points = profile?.points ?? 0;
            final analyses = profile?.analyses ?? 0;
            final tips = profile?.tips ?? 0;

            final sources = [
              ('تحليلات البشرة', analyses * 15),
              ('النصائح المطبّقة', tips * 5),
            ];

            final rewards = [
              'خصم 10% على منتجات العناية',
              'استشارة مجانية مع أخصائية',
              'دخول سحب على هدايا حصرية',
            ];

            return SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PremiumCard(
                    gradient: const LinearGradient(
                      colors: [AppColors.goldLight, AppColors.cardOrange],
                    ),
                    child: Column(
                      children: [
                        Text('نقاطك الحالية', style: AppTypography.titleMedium),
                        const SizedBox(height: 8),
                        AnimatedCounter(
                          value: points,
                          style: AppTypography.displayLarge.copyWith(color: AppColors.gold),
                        ),
                        Text(
                          'المستوى: ${profile?.level ?? 'مبتدئة'}',
                          style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  const SectionHeader(title: 'مصادر النقاط'),
                  ...sources.map(
                    (s) => PremiumCard(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_rounded, color: AppColors.success),
                          const SizedBox(width: 12),
                          Expanded(child: Text(s.$1, style: AppTypography.bodyMedium)),
                          Text(
                            '${s.$2}',
                            style: AppTypography.titleMedium.copyWith(color: AppColors.primary),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SectionHeader(title: 'مكافآت مقترحة'),
                  ...rewards.map(
                    (r) => PremiumCard(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          const Icon(Icons.card_giftcard_rounded, color: AppColors.gold),
                          const SizedBox(width: 12),
                          Expanded(child: Text(r, style: AppTypography.bodyMedium)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
