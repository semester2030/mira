import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';

/// Premium face guide with AI mesh dots and optional analyzing mode.
class FaceGuideOverlay extends StatelessWidget {
  final Rect faceRect;
  final double pulse;
  final double scanProgress;
  final bool showLabel;
  final bool aiMode;

  const FaceGuideOverlay({
    super.key,
    required this.faceRect,
    this.pulse = 0,
    this.scanProgress = 0,
    this.showLabel = true,
    this.aiMode = true,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _FaceGuidePainter(
        faceRect: faceRect,
        pulse: pulse,
        scanProgress: scanProgress,
        aiMode: aiMode,
      ),
      child: showLabel
          ? SizedBox(
              width: faceRect.width,
              height: faceRect.height,
              child: Stack(
                children: [
                  if (aiMode)
                    Align(
                      alignment: Alignment.topCenter,
                      child: Container(
                        margin: const EdgeInsets.only(top: 14),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.45),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: AppColors.gold.withValues(alpha: 0.55),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.auto_awesome_rounded,
                              size: 12,
                              color: AppColors.gold.withValues(alpha: 0.95),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'MIRA AI SCAN',
                              style: TextStyle(
                                color: AppColors.gold.withValues(alpha: 0.95),
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 18),
                      child: Text(
                        aiMode ? 'ثبّتي وجهك — المسح الذكي جاهز' : 'ضعي وجهك داخل الإطار',
                        style: TextStyle(
                          color: AppColors.onPrimary.withValues(alpha: 0.92),
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                          shadows: const [
                            Shadow(color: Colors.black54, blurRadius: 8),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            )
          : null,
    );
  }
}

class _FaceGuidePainter extends CustomPainter {
  final Rect faceRect;
  final double pulse;
  final double scanProgress;
  final bool aiMode;

  _FaceGuidePainter({
    required this.faceRect,
    required this.pulse,
    required this.scanProgress,
    required this.aiMode,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final oval = Path()..addOval(faceRect);
    final backdrop = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final mask = Path.combine(PathOperation.difference, backdrop, oval);

    canvas.drawPath(
      mask,
      Paint()..color = Colors.black.withValues(alpha: 0.58),
    );

    if (aiMode) {
      _drawAiMesh(canvas, faceRect, pulse);
    }

    final glow = 0.45 + (pulse * 0.55);
    canvas.drawOval(
      faceRect,
      Paint()
        ..color = AppColors.primary.withValues(alpha: glow)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.8,
    );
    canvas.drawOval(
      faceRect.deflate(6),
      Paint()
        ..color = AppColors.gold.withValues(alpha: 0.35 + pulse * 0.25)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    _drawCorners(canvas, faceRect);

    final scanY = faceRect.top + (faceRect.height * scanProgress);
    canvas.drawLine(
      Offset(faceRect.left + 16, scanY),
      Offset(faceRect.right - 16, scanY),
      Paint()
        ..shader = LinearGradient(
          colors: [
            Colors.transparent,
            AppColors.gold.withValues(alpha: 0.85),
            Colors.transparent,
          ],
        ).createShader(Rect.fromLTWH(faceRect.left, scanY - 1, faceRect.width, 2))
        ..strokeWidth = 2.5,
    );
  }

  void _drawAiMesh(Canvas canvas, Rect rect, double pulse) {
    final dotPaint = Paint()
      ..color = AppColors.gold.withValues(alpha: 0.22 + pulse * 0.18);
    const cols = 5;
    const rows = 7;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        final tX = (c + 0.5) / cols;
        final tY = (r + 0.5) / rows;
        final angle = (tX - 0.5) * math.pi * 0.35;
        final rx = rect.width / 2 * (1 - tY * 0.12);
        final cx = rect.center.dx + math.sin(angle) * rx * (tX * 2 - 1);
        final cy = rect.top + tY * rect.height;
        canvas.drawCircle(Offset(cx, cy), 1.6 + pulse, dotPaint);
      }
    }
  }

  void _drawCorners(Canvas canvas, Rect rect) {
    const len = 28.0;
    const stroke = 3.5;
    final paint = Paint()
      ..color = AppColors.gold.withValues(alpha: 0.95)
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(Offset(rect.left, rect.top + len), Offset(rect.left, rect.top), paint);
    canvas.drawLine(Offset(rect.left, rect.top), Offset(rect.left + len, rect.top), paint);

    canvas.drawLine(Offset(rect.right, rect.top + len), Offset(rect.right, rect.top), paint);
    canvas.drawLine(Offset(rect.right, rect.top), Offset(rect.right - len, rect.top), paint);

    canvas.drawLine(
      Offset(rect.left, rect.bottom - len),
      Offset(rect.left, rect.bottom),
      paint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.bottom),
      Offset(rect.left + len, rect.bottom),
      paint,
    );

    canvas.drawLine(
      Offset(rect.right, rect.bottom - len),
      Offset(rect.right, rect.bottom),
      paint,
    );
    canvas.drawLine(
      Offset(rect.right, rect.bottom),
      Offset(rect.right - len, rect.bottom),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _FaceGuidePainter oldDelegate) {
    return oldDelegate.faceRect != faceRect ||
        oldDelegate.pulse != pulse ||
        oldDelegate.scanProgress != scanProgress ||
        oldDelegate.aiMode != aiMode;
  }
}

/// Computes a centered face oval for the current layout constraints.
Rect computeFaceGuideRect(Size size, {double widthFactor = 0.78}) {
  final width = size.width * widthFactor;
  final height = width * 1.32;
  final left = (size.width - width) / 2;
  final top = math.max(16.0, (size.height - height) / 2);
  return Rect.fromLTWH(left, top, width, height);
}
