import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../../shared/geometry/face_anatomy_geometry.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// YouCam Playground–style live scan on the user's face during server analysis.
class AiAnalysisOverlay extends StatefulWidget {
  final Rect? faceRect;

  const AiAnalysisOverlay({
    super.key,
    this.faceRect,
  });

  @override
  State<AiAnalysisOverlay> createState() => _AiAnalysisOverlayState();
}

class _ScanConcern {
  final String id;
  final String labelAr;
  final Color color;
  final List<String> zoneIds;

  const _ScanConcern(this.id, this.labelAr, this.color, this.zoneIds);
}

class _AiAnalysisOverlayState extends State<AiAnalysisOverlay>
    with SingleTickerProviderStateMixin {
  static const _concerns = [
    _ScanConcern('moisture', 'الترطيب', Color(0xFF3498DB), ['cheek_left', 'cheek_right']),
    _ScanConcern('oiliness', 'الدهون', Color(0xFFF5A623), ['forehead', 'nose', 'chin']),
    _ScanConcern('pore', 'المسام', Color(0xFF9B59B6), ['nose', 'chin', 'forehead']),
    _ScanConcern('age_spot', 'التصبغات', Color(0xFFD35400), ['cheek_left', 'cheek_right', 'forehead']),
    _ScanConcern('redness', 'الاحمرار', Color(0xFFE74C3C), ['cheek_left', 'cheek_right', 'nose']),
    _ScanConcern('wrinkle', 'التجاعيد', Color(0xFF8E44AD), ['forehead', 'under_eye']),
  ];

  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final face = widget.faceRect;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        final concernIndex =
            (t * _concerns.length).floor() % _concerns.length;
        final active = _concerns[concernIndex];
        final scanPulse = (math.sin(t * math.pi * 2) + 1) / 2;

        return Stack(
          fit: StackFit.expand,
          children: [
            Container(color: Colors.black.withValues(alpha: 0.28)),
            if (face != null)
              CustomPaint(
                painter: _YouCamScanPainter(
                  faceRect: face,
                  activeConcern: active,
                  progress: t,
                  scanPulse: scanPulse,
                  concerns: _concerns,
                  activeIndex: concernIndex,
                ),
              )
            else
              CustomPaint(painter: _AiGridPainter(progress: t)),
            Positioned(
              left: 16,
              right: 16,
              bottom: 20,
              child: _ScanStatusBar(
                label: active.labelAr,
                color: active.color,
                progress: (t * _concerns.length) % 1,
              ),
            ),
            Positioned(
              top: 16,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.gold.withValues(alpha: 0.45)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.biotech_outlined,
                        size: 16,
                        color: active.color.withValues(alpha: 0.95),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'MIRA AI — مسح مباشر',
                        style: AppTypography.labelMedium.copyWith(
                          color: AppColors.onPrimary,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ScanStatusBar extends StatelessWidget {
  final String label;
  final Color color;
  final double progress;

  const _ScanStatusBar({
    required this.label,
    required this.color,
    required this.progress,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'جاري تحليل: $label',
                  style: AppTypography.labelLarge.copyWith(color: AppColors.onPrimary),
                ),
              ),
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              backgroundColor: Colors.white.withValues(alpha: 0.12),
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _YouCamScanPainter extends CustomPainter {
  final Rect faceRect;
  final _ScanConcern activeConcern;
  final double progress;
  final double scanPulse;
  final List<_ScanConcern> concerns;
  final int activeIndex;

  _YouCamScanPainter({
    required this.faceRect,
    required this.activeConcern,
    required this.progress,
    required this.scanPulse,
    required this.concerns,
    required this.activeIndex,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final facePath = FaceAnatomyGeometry.outlinePath(faceRect);
    final zones = FaceAnatomyGeometry.zoneAnchors(faceRect);
    final activeSet = activeConcern.zoneIds.toSet();

    canvas.save();
    canvas.clipPath(facePath);

    for (final entry in zones.entries) {
      final isActive = activeSet.contains(entry.key);
      _drawZone(canvas, entry.key, faceRect, isActive);
    }

    FaceAnatomyGeometry.drawScanLine(
      canvas,
      faceRect,
      progress,
      Paint()
        ..shader = ui.Gradient.linear(
          Offset(faceRect.left, faceRect.top),
          Offset(faceRect.right, faceRect.top),
          [
            Colors.transparent,
            activeConcern.color.withValues(alpha: 0.85),
            Colors.transparent,
          ],
        )
        ..strokeWidth = 2.2,
    );
    canvas.restore();

    canvas.drawPath(
      facePath,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    for (var i = 0; i < concerns.length; i++) {
      final concern = concerns[i];
      final badgePos = _badgePosition(size, faceRect, i, concerns.length);
      final anchor = zones[concern.zoneIds.first] ?? faceRect.center;
      final isActive = i == activeIndex;

      _drawConnector(canvas, anchor, badgePos, concern.color, isActive);
      _drawBadge(
        canvas,
        badgePos,
        concern.labelAr,
        isActive ? '···' : '',
        concern.color,
        isActive,
      );
    }
  }

  void _drawZone(
    Canvas canvas,
    String zoneId,
    Rect face,
    bool active,
  ) {
    final color = active ? activeConcern.color : Colors.white;
    final alpha = active ? 0.28 + scanPulse * 0.18 : 0.08;
    final path = FaceAnatomyGeometry.zonePath(face, zoneId);

    canvas.drawPath(
      path,
      Paint()
        ..color = color.withValues(alpha: alpha)
        ..style = PaintingStyle.fill,
    );

    if (active) {
      canvas.drawPath(
        path,
        Paint()
          ..color = color.withValues(alpha: 0.55)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4,
      );

      if (zoneId == 'forehead' || zoneId == 'cheek_left' || zoneId == 'cheek_right') {
        final bounds = path.getBounds();
        if (bounds.width > 4 && bounds.height > 4) {
          _drawMeshDots(canvas, bounds, color, path);
        }
      }
    }
  }

  void _drawMeshDots(Canvas canvas, Rect rect, Color color, Path clip) {
    final paint = Paint()..color = color.withValues(alpha: 0.45);
    for (var i = 0; i < 12; i++) {
      final x = rect.left + rect.width * ((i % 4) + 0.5) / 4;
      final y = rect.top + rect.height * ((i ~/ 4) + 0.5) / 3;
      final point = Offset(x, y);
      if (clip.contains(point)) {
        canvas.drawCircle(point, 1.8, paint);
      }
    }
  }

  void _drawConnector(
    Canvas canvas,
    Offset from,
    Offset to,
    Color color,
    bool active,
  ) {
    canvas.drawLine(
      from,
      to,
      Paint()
        ..color = Colors.white.withValues(alpha: active ? 0.75 : 0.25)
        ..strokeWidth = active ? 1.4 : 0.8,
    );
  }

  void _drawBadge(
    Canvas canvas,
    Offset center,
    String label,
    String score,
    Color color,
    bool active,
  ) {
    const w = 78.0;
    const h = 52.0;
    final rect = Rect.fromCenter(center: center, width: w, height: h);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(26)),
      Paint()..color = Colors.white.withValues(alpha: active ? 0.95 : 0.72),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(26)),
      Paint()
        ..color = color.withValues(alpha: active ? 0.85 : 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = active ? 2 : 1,
    );

    _drawText(canvas, score.isEmpty ? '—' : score, rect.top + 10, rect.center.dx, 13, color, FontWeight.w800);
    _drawText(canvas, label, rect.top + 28, rect.center.dx, 9, const Color(0xFF666666), FontWeight.w600);
  }

  void _drawText(
    Canvas canvas,
    String text,
    double top,
    double centerX,
    double size,
    Color color,
    FontWeight weight,
  ) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(color: color, fontSize: size, fontWeight: weight),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.rtl,
    )..layout(maxWidth: 72);
    tp.paint(canvas, Offset(centerX - tp.width / 2, top));
  }

  Offset _badgePosition(Size size, Rect face, int index, int total) {
    final positions = [
      Offset(face.left - 6, face.top + face.height * 0.14),
      Offset(face.right + 6, face.top + face.height * 0.26),
      Offset(face.left - 10, face.top + face.height * 0.58),
      Offset(face.right + 10, face.top + face.height * 0.68),
      Offset(face.left + face.width * 0.10, face.top - 4),
      Offset(face.right - face.width * 0.10, face.top - 4),
    ];
    return positions[index % positions.length];
  }

  @override
  bool shouldRepaint(covariant _YouCamScanPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.activeIndex != activeIndex;
}

class _AiGridPainter extends CustomPainter {
  final double progress;

  _AiGridPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final scanY = size.height * progress;
    canvas.drawLine(
      Offset(0, scanY),
      Offset(size.width, scanY),
      Paint()
        ..shader = ui.Gradient.linear(
          Offset(0, scanY),
          Offset(size.width, scanY),
          [
            Colors.transparent,
            AppColors.primary.withValues(alpha: 0.55),
            AppColors.gold.withValues(alpha: 0.75),
            AppColors.primary.withValues(alpha: 0.55),
            Colors.transparent,
          ],
        )
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(covariant _AiGridPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
