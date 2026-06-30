import 'package:flutter/material.dart';

import '../../domain/entities/outfit_body_pose_metrics.dart';
import '../../domain/services/outfit_body_silhouette_builder.dart';
import '../../../../shared/theme/colors.dart';

/// Live pose skeleton + adaptive segment boxes on camera preview.
class OutfitPoseTrackingOverlay extends StatelessWidget {
  final OutfitBodyPoseMetrics pose;
  final bool frameReady;
  final double pulse;

  const OutfitPoseTrackingOverlay({
    super.key,
    required this.pose,
    required this.frameReady,
    required this.pulse,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _OutfitPoseTrackingPainter(
        pose: pose,
        frameReady: frameReady,
        pulse: pulse,
      ),
      child: const SizedBox.expand(),
    );
  }
}

class _OutfitPoseTrackingPainter extends CustomPainter {
  final OutfitBodyPoseMetrics pose;
  final bool frameReady;
  final double pulse;

  _OutfitPoseTrackingPainter({
    required this.pose,
    required this.frameReady,
    required this.pulse,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (!pose.hasDetailedTracking) return;

    final points = pose.landmarkPoints;
    Offset map(String key) {
      final p = points[key]!;
      return Offset(p.dx * size.width, p.dy * size.height);
    }

    final skeletonPaint = Paint()
      ..color = AppColors.secondary.withValues(alpha: 0.75 + pulse * 0.15)
      ..strokeWidth = 2.4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    for (final (a, b) in OutfitBodySilhouetteBuilder.skeletonConnections) {
      if (!points.containsKey(a) || !points.containsKey(b)) continue;
      canvas.drawLine(map(a), map(b), skeletonPaint);
    }

    final jointPaint = Paint()..color = AppColors.gold.withValues(alpha: 0.9);
    for (final entry in points.entries) {
      canvas.drawCircle(map(entry.key), 4.2, jointPaint);
    }

    final zonePaint = Paint()
      ..color = (frameReady ? AppColors.secondary : AppColors.gold)
          .withValues(alpha: 0.35 + pulse * 0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;

    for (final region in pose.segmentRegions) {
      final r = region.normalizedRect;
      final rect = Rect.fromLTWH(
        r.left * size.width,
        r.top * size.height,
        r.width * size.width,
        r.height * size.height,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(8)),
        zonePaint,
      );
    }

    if (pose.bodyBounds != null) {
      final b = pose.bodyBounds!;
      final bodyRect = Rect.fromLTWH(
        b.left * size.width,
        b.top * size.height,
        b.width * size.width,
        b.height * size.height,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(bodyRect, const Radius.circular(16)),
        Paint()
          ..color = AppColors.onPrimary.withValues(alpha: 0.55)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.2,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _OutfitPoseTrackingPainter oldDelegate) {
    return oldDelegate.pose != pose ||
        oldDelegate.frameReady != frameReady ||
        oldDelegate.pulse != pulse;
  }
}
