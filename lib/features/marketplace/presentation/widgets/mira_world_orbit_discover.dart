import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/config/mira_features.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/discover_catalog_query.dart';
import '../../data/lane_orb_assets.dart';

/// Home block: «اكتشفي عالم ميرا» — six fixed photo circles around MIRA logo.
/// Clockwise from top (visual): أناقتك ← جمالك ← الأطفال ← الهدايا ← مناسباتك ← المجوهرات.
class MiraWorldOrbitDiscover extends StatelessWidget {
  const MiraWorldOrbitDiscover({super.key, this.onLaneOpened});

  /// Test hook: reports Arabic title → lane id when a circle is pressed.
  final void Function(String titleAr, DiscoverLane lane)? onLaneOpened;

  static const _orbit = <({String title, DiscoverLane lane, String imageKey})>[
    (title: 'أناقتك', lane: DiscoverLane.elegance, imageKey: 'elegance'),
    (title: 'جمالك', lane: DiscoverLane.beauty, imageKey: 'beauty'),
    (title: 'الأطفال', lane: DiscoverLane.children, imageKey: 'children'),
    (title: 'الهدايا', lane: DiscoverLane.gifts, imageKey: 'gifts'),
    (title: 'مناسباتك', lane: DiscoverLane.occasions, imageKey: 'occasions'),
    (title: 'المجوهرات', lane: DiscoverLane.jewelry, imageKey: 'jewelry'),
  ];

  void _open(BuildContext context, String title, DiscoverLane lane) {
    onLaneOpened?.call(title, lane);
    if (!MiraFeatures.marketplaceEnabled) {
      Navigator.pushNamed(context, AppRoutes.discover);
      return;
    }
    Navigator.pushNamed(context, AppRoutes.discoverPresentation, arguments: lane);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'اكتشفي عالم ميرا',
          textAlign: TextAlign.center,
          style: AppTypography.titleLarge.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          'اختاري ما يلهمك',
          textAlign: TextAlign.center,
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            // Fit six labeled circles on small phones without clipping.
            final side = width.clamp(280.0, 420.0);
            final orbitR = side * 0.34;
            final circle = (side * 0.22).clamp(56.0, 78.0);
            final center = (side * 0.20).clamp(52.0, 72.0);
            final labelH = 22.0;
            final canvasH = side + labelH + 8;
            return SizedBox(
              height: canvasH,
              child: Center(
                child: SizedBox(
                  width: side,
                  height: canvasH,
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      for (var i = 0; i < _orbit.length; i++)
                        _orbitPetal(
                          context: context,
                          index: i,
                          side: side,
                          orbitR: orbitR,
                          circle: circle,
                          labelH: labelH,
                          item: _orbit[i],
                        ),
                      _CenterLogo(size: center),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _orbitPetal({
    required BuildContext context,
    required int index,
    required double side,
    required double orbitR,
    required double circle,
    required double labelH,
    required ({String title, DiscoverLane lane, String imageKey}) item,
  }) {
    // Top = -90°, then clockwise (screen coords: +angle is clockwise when y grows down).
    final angle = -math.pi / 2 + index * (2 * math.pi / 6);
    final cx = side / 2 + orbitR * math.cos(angle);
    final cy = (side / 2) + orbitR * math.sin(angle);
    final asset = LaneOrbAssets.assetForImageKey(item.imageKey)!;
    final left = cx - circle / 2;
    final top = cy - circle / 2;
    return Positioned(
      left: left,
      top: top,
      width: circle,
      child: Semantics(
        button: true,
        label: item.title,
        child: InkWell(
          onTap: () => _open(context, item.title, item.lane),
          customBorder: const CircleBorder(),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: circle,
                height: circle,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.55), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: Image.asset(
                    asset,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.primaryLight),
                  ),
                ),
              ),
              SizedBox(
                height: labelH,
                child: Center(
                  child: Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: AppTypography.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                      height: 1.1,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CenterLogo extends StatelessWidget {
  const _CenterLogo({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.35), width: 1.5),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      padding: EdgeInsets.all(size * 0.18),
      child: Image.asset(
        'assets/images/mira_logo_icon.png',
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => const Icon(Icons.spa, color: AppColors.primary),
      ),
    );
  }
}
