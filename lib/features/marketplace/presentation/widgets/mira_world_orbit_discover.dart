import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/discover_catalog_query.dart';
import '../../data/lane_orb_assets.dart';

/// Home block: «اكتشفي عالم ميرا» — six fixed photo circles around MIRA logo.
/// Clockwise from top (visual): أناقتك ← جمالك ← الأطفال ← الهدايا ← مناسباتك ← المجوهرات.
///
/// Geometry is derived from the approved home reference 853×1844
/// (`docs/phase2_3/evidence/REF_ORBIT_GEOMETRY.txt`): thin pink orbit ring behind
/// petals; center white MIRA disc ≈ 1.25× petal diameter.
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
    // Always open the real presentation screen with the lane id.
    // Do not fall back to a generic hub that drops the section identity.
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
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            // Fit six labeled circles on small phones without clipping.
            final side = width.clamp(300.0, 420.0);
            // Reference ratios vs orbit canvas (~petal 0.206 of canvas, R 0.40, center 1.25× petal).
            final petal = (side * 0.205).clamp(58.0, 86.0);
            final center = petal * 1.25;
            final orbitR = side * 0.395;
            const labelH = 20.0;
            // Extra bottom room so the lowest label is not clipped.
            final canvasH = side + labelH + 12;
            final originY = (canvasH - side) / 2;
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
                      Positioned.fill(
                        child: CustomPaint(
                          painter: _OrbitRingPainter(
                            center: Offset(side / 2, originY + side / 2),
                            radius: orbitR,
                            color: AppColors.primary.withValues(alpha: 0.55),
                          ),
                        ),
                      ),
                      for (var i = 0; i < _orbit.length; i++)
                        _orbitPetal(
                          context: context,
                          index: i,
                          side: side,
                          originY: originY,
                          orbitR: orbitR,
                          petal: petal,
                          labelH: labelH,
                          item: _orbit[i],
                        ),
                      Positioned(
                        left: (side - center) / 2,
                        top: originY + (side - center) / 2,
                        width: center,
                        height: center,
                        child: _CenterLogo(size: center),
                      ),
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
    required double originY,
    required double orbitR,
    required double petal,
    required double labelH,
    required ({String title, DiscoverLane lane, String imageKey}) item,
  }) {
    // Top = -90°, then clockwise (screen coords: +angle is clockwise when y grows down).
    final angle = -math.pi / 2 + index * (2 * math.pi / 6);
    final cx = side / 2 + orbitR * math.cos(angle);
    final cy = originY + side / 2 + orbitR * math.sin(angle);
    final asset = LaneOrbAssets.homeOrbitAssetForImageKey(item.imageKey)!;
    // Extra horizontal room so Arabic labels are not clipped between neighbors.
    final slotW = petal + 28;
    final left = cx - slotW / 2;
    final top = cy - petal / 2;
    return Positioned(
      left: left,
      top: top,
      width: slotW,
      child: Semantics(
        button: true,
        label: item.title,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: () => _open(context, item.title, item.lane),
            customBorder: const CircleBorder(),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: petal,
                  height: petal,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white.withValues(alpha: 0.85), width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.14),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
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
                ),
                SizedBox(
                  height: labelH,
                  width: slotW,
                  child: Center(
                    child: Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.clip,
                      softWrap: false,
                      textAlign: TextAlign.center,
                      style: AppTypography.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                        height: 1.15,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OrbitRingPainter extends CustomPainter {
  _OrbitRingPainter({required this.center, required this.radius, required this.color});

  final Offset center;
  final double radius;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..isAntiAlias = true;
    canvas.drawCircle(center, radius, paint);
  }

  @override
  bool shouldRepaint(covariant _OrbitRingPainter oldDelegate) {
    return oldDelegate.center != center || oldDelegate.radius != radius || oldDelegate.color != color;
  }
}

class _CenterLogo extends StatelessWidget {
  const _CenterLogo({required this.size});
  final double size;

  /// Silhouette + MIRA wordmark cropped from the approved home reference.
  /// Keeps assets/images/mira_logo_* unchanged for other screens.
  static const assetPath = 'assets/marketplace/discover/home_orbit/mira_center_logo.png';

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.28), width: 1.25),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: ClipOval(
        child: Image.asset(
          assetPath,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Padding(
            padding: EdgeInsets.all(size * 0.18),
            child: Image.asset(
              'assets/images/mira_logo_icon.png',
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Icon(Icons.spa, color: AppColors.primary),
            ),
          ),
        ),
      ),
    );
  }
}
