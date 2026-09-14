import 'package:flutter/material.dart';

import '../../../projection/contracts/face_result_enums.dart';
import '../mapping/face_region_hit_geometry.dart';
import '../tokens/face_result_tokens.dart';

/// Soft ILLUSTRATIVE region halo + calm oval contour (DERIVED / DECORATIVE).
class FaceResultOverlayPainter extends CustomPainter {
  FaceResultOverlayPainter({
    required this.faceBox,
    required this.contourAllowed,
    required this.contourCalm,
    required this.selectedRegion,
  });

  final Rect faceBox;
  final bool contourAllowed;
  final bool contourCalm;
  final FacePresentationRegion? selectedRegion;

  @override
  void paint(Canvas canvas, Size size) {
    if (contourAllowed) {
      final oval = Rect.fromCenter(
        center: faceBox.center,
        width: faceBox.width * 0.72,
        height: faceBox.height * 0.88,
      );
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = contourCalm ? 1.4 : 1.8
        ..color = contourCalm
            ? FaceResultTokens.contourCalm
            : FaceResultTokens.contour.withValues(alpha: 0.7);
      canvas.drawOval(oval, paint);
    }

    if (selectedRegion != null) {
      final r = FaceRegionHitGeometry.rectFor(selectedRegion!, faceBox);
      final glow = Paint()
        ..style = PaintingStyle.fill
        ..color = FaceResultTokens.selectedGlow;
      final halo = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = FaceResultTokens.regionHalo;
      canvas.drawRRect(
        RRect.fromRectAndRadius(r.inflate(4), const Radius.circular(18)),
        glow,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(r.inflate(4), const Radius.circular(18)),
        halo,
      );
    }
  }

  @override
  bool shouldRepaint(covariant FaceResultOverlayPainter oldDelegate) {
    return oldDelegate.faceBox != faceBox ||
        oldDelegate.contourAllowed != contourAllowed ||
        oldDelegate.contourCalm != contourCalm ||
        oldDelegate.selectedRegion != selectedRegion;
  }
}
