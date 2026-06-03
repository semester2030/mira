import 'package:flutter/material.dart';

import '../../delight/delight_background.dart';

/// Soft ambient gradient with slow motion and optional particles.
class FloatingGradientBackground extends StatelessWidget {
  final Widget child;
  final bool showOrbs;
  final bool showParticles;

  const FloatingGradientBackground({
    super.key,
    required this.child,
    this.showOrbs = false,
    this.showParticles = false,
  });

  @override
  Widget build(BuildContext context) {
    return DelightBackground(
      showOrbs: showOrbs,
      showParticles: showParticles,
      child: child,
    );
  }
}
