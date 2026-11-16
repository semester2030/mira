import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';

/// Circular static badge for home analysis cards (skin / outfit).
/// Shows a tool-forward illustration — not a plain face icon.
class HomeAnalysisStaticBadge extends StatelessWidget {
  const HomeAnalysisStaticBadge({
    super.key,
    required this.assetPath,
    this.size = 128,
  });

  final String assetPath;
  final double size;

  static const skinAsset = 'assets/images/home_skin_analysis_static.png';
  static const outfitAsset = 'assets/images/home_outfit_analysis_static.png';

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.onPrimary.withValues(alpha: 0.55),
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.12),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipOval(
          child: Image.asset(
            assetPath,
            fit: BoxFit.cover,
            alignment: Alignment.center,
            filterQuality: FilterQuality.high,
            gaplessPlayback: true,
            errorBuilder: (_, __, ___) => ColoredBox(
              color: AppColors.onPrimary.withValues(alpha: 0.18),
              child: Icon(
                Icons.auto_awesome_rounded,
                color: AppColors.onPrimary,
                size: size * 0.34,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
