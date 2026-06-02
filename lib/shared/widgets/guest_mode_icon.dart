import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Branded guest-mode mark — rose-gold Mira palette (assets/icons/guest_icon.svg).
class GuestModeIcon extends StatelessWidget {
  static const assetPath = 'assets/icons/guest_icon.svg';

  final double size;
  final BoxFit fit;

  const GuestModeIcon({
    super.key,
    this.size = 28,
    this.fit = BoxFit.contain,
  });

  const GuestModeIcon.small({super.key}) : size = 24, fit = BoxFit.contain;

  const GuestModeIcon.large({super.key}) : size = 48, fit = BoxFit.contain;

  const GuestModeIcon.profile({super.key}) : size = 56, fit = BoxFit.contain;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      assetPath,
      width: size,
      height: size,
      fit: fit,
    );
  }
}
