import 'package:flutter/material.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/constants/marketplace_copy.dart';
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
      body: const SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(20),
          child: DiscoverLaneEntries(),
        ),
      ),
    );
  }
}
