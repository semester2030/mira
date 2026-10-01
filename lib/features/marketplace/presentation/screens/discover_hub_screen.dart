import 'package:flutter/material.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../widgets/discover_lane_entries.dart';
import '../widgets/marketplace_coming_soon_view.dart';

/// Hub: brands, clinics, salons — or coming-soon when marketplace is off.
class DiscoverHubScreen extends StatelessWidget {
  const DiscoverHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    if (!MiraFeatures.marketplaceEnabled) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: const MiraAppBar(pageTitle: MarketplaceCopy.hubTitle),
        body: FloatingGradientBackground(
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: const MarketplaceComingSoonView(),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const MiraAppBar(pageTitle: 'أناقتك وجمالك'),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const DiscoverLaneEntries(),
              const SizedBox(height: 16),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                children: [
                  for (final entry in const [
                    (AppRoutes.cart, 'السلة', Icons.shopping_bag_outlined),
                    (AppRoutes.myOrders, 'طلباتي', Icons.receipt_long_outlined),
                    (AppRoutes.myBookings, 'حجوزاتي', Icons.event_outlined),
                    (AppRoutes.favorites, MarketplaceCopy.favoritesTitle, Icons.favorite_border),
                  ])
                    TextButton.icon(
                      onPressed: () => Navigator.of(context).pushNamed(entry.$1),
                      icon: Icon(entry.$3),
                      label: Text(entry.$2),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
