import 'package:flutter/material.dart';

/// 1200×1680 transparent PNG — luxury 3D face base layer.
abstract final class PremiumFaceBaseImage {
  static const assetPath = 'assets/images/premium_face_base.png';

  static Widget layer({required Rect faceBounds}) {
    return Positioned.fromRect(
      rect: faceBounds,
      child: Image.asset(
        assetPath,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
        isAntiAlias: true,
        gaplessPlayback: true,
        // Preserve PNG alpha — no colored matte behind the face.
        excludeFromSemantics: true,
        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
      ),
    );
  }
}
