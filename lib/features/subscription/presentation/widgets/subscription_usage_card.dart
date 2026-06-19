import 'package:flutter/material.dart';

import '../../../../core/config/mira_features.dart';
import '../../data/repositories/subscription_repository_impl.dart';
import '../../domain/entities/subscription_status.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class SubscriptionUsageCard extends StatefulWidget {
  const SubscriptionUsageCard({super.key});

  @override
  State<SubscriptionUsageCard> createState() => _SubscriptionUsageCardState();
}

class _SubscriptionUsageCardState extends State<SubscriptionUsageCard> {
  final _repo = SubscriptionRepositoryImpl();
  late Future<SubscriptionStatus> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.getStatus();
  }

  @override
  Widget build(BuildContext context) {
    if (AppSession.isGuest || !MiraFeatures.showSubscriptionManagementUi) {
      return const SizedBox.shrink();
    }

    return FutureBuilder<SubscriptionStatus>(
      future: _future,
      builder: (context, snap) {
        if (!snap.hasData) return const SizedBox.shrink();
        final s = snap.data!;

        return PremiumCard(
          onTap: () => Navigator.pushNamed(context, AppRoutes.manageSubscription),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    s.isPremium ? Icons.diamond : Icons.card_membership_outlined,
                    color: s.isPremium ? AppColors.secondary : AppColors.primary,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      s.isPremium ? 'ميرا بريميوم' : 'الخطة المجانية',
                      style: AppTypography.titleMedium,
                    ),
                  ),
                  const Icon(Icons.chevron_left, size: 20, color: AppColors.textSecondary),
                ],
              ),
              if (!s.isPremium) ...[
                const SizedBox(height: 10),
                Text(
                  'بشرة: ${s.usage.skinRemaining} · إطلالة: ${s.usage.outfitRemaining} متبقية هذا الشهر',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
