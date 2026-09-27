import 'package:flutter/material.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/discover_catalog_query.dart';

/// Home entries that open a lane directly. RTL puts أناقتك on the right.
class DiscoverLaneEntries extends StatelessWidget {
  const DiscoverLaneEntries({super.key});

  void _open(BuildContext context, DiscoverLane lane) {
    if (!MiraFeatures.marketplaceEnabled) {
      Navigator.pushNamed(context, AppRoutes.discover);
      return;
    }
    Navigator.pushNamed(context, AppRoutes.discoverPresentation, arguments: lane);
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final scale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.4);
    return LayoutBuilder(
      builder: (context, constraints) {
        final diameter = ((constraints.maxWidth - 28) / 2).clamp(112.0, 168.0);
        return Row(
          textDirection: TextDirection.rtl,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _LaneCircle(
                diameter: diameter,
                scale: scale,
                reduceMotion: reduceMotion,
                image: 'assets/marketplace/discover/elegance_lane.png',
                title: 'أناقتك',
                subtitle: 'تجميل، أزياء وإكسسوارات',
                onTap: () => _open(context, DiscoverLane.elegance),
              ),
            ),
            const SizedBox(width: 28),
            Expanded(
              child: _LaneCircle(
                diameter: diameter,
                scale: scale,
                reduceMotion: reduceMotion,
                image: 'assets/marketplace/discover/beauty_lane.png',
                title: 'جمالك',
                subtitle: 'عيادات، مشاغل وعناية',
                onTap: () => _open(context, DiscoverLane.beauty),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _LaneCircle extends StatelessWidget {
  const _LaneCircle({
    required this.diameter,
    required this.scale,
    required this.reduceMotion,
    required this.image,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final double diameter;
  final double scale;
  final bool reduceMotion;
  final String image;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final circle = Semantics(
      button: true,
      label: '$title. $subtitle',
      child: PressableScale(
        onTap: onTap,
        child: Column(
          children: [
            Container(
              width: diameter,
              height: diameter,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.primary, width: 2),
                boxShadow: [
                  BoxShadow(color: AppColors.primary.withValues(alpha: 0.16), blurRadius: 16, offset: const Offset(0, 6)),
                ],
              ),
              child: ClipOval(
                child: Image.asset(
                  image,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.primaryLight),
                ),
              ),
            ),
            SizedBox(height: 12 * scale),
            Text(title, textAlign: TextAlign.center, style: AppTypography.titleLarge),
            const SizedBox(height: 4),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, height: 1.4),
            ),
          ],
        ),
      ),
    );
    if (reduceMotion) return circle;
    return circle;
  }
}
