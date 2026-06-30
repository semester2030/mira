import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../shared/theme/animations.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/outfit_segment_map.dart';

/// Premium contour overlay — pixel-refined polygons when available.
class OutfitSegmentMapOverlay extends StatelessWidget {
  final File imageFile;
  final OutfitSegmentMap segmentMap;
  final bool interactive;
  final OutfitSegmentZone? selectedZone;
  final ValueChanged<OutfitSegmentRegion>? onRegionTap;

  const OutfitSegmentMapOverlay({
    super.key,
    required this.imageFile,
    required this.segmentMap,
    this.interactive = false,
    this.selectedZone,
    this.onRegionTap,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: AspectRatio(
        aspectRatio: segmentMap.imageWidth > 0 && segmentMap.imageHeight > 0
            ? segmentMap.imageWidth / segmentMap.imageHeight
            : 3 / 4,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.file(imageFile, fit: BoxFit.cover),
            ...segmentMap.regions.asMap().entries.map(
              (entry) => _RegionOverlay(
                region: entry.value,
                index: entry.key,
                interactive: interactive,
                selected: selectedZone == entry.value.zone,
                onTap: onRegionTap == null ? null : () => onRegionTap!(entry.value),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RegionOverlay extends StatefulWidget {
  final OutfitSegmentRegion region;
  final int index;
  final bool interactive;
  final bool selected;
  final VoidCallback? onTap;

  const _RegionOverlay({
    required this.region,
    this.index = 0,
    this.interactive = false,
    this.selected = false,
    this.onTap,
  });

  @override
  State<_RegionOverlay> createState() => _RegionOverlayState();
}

class _RegionOverlayState extends State<_RegionOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _reveal;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    );
    _reveal = CurvedAnimation(parent: _controller, curve: AppAnimations.slowCurve);
    Future<void>.delayed(Duration(milliseconds: 180 + widget.index * 130), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight;
        final box = Rect.fromLTRB(
          widget.region.normalizedRect.left * w,
          widget.region.normalizedRect.top * h,
          widget.region.normalizedRect.right * w,
          widget.region.normalizedRect.bottom * h,
        );

        return AnimatedBuilder(
          animation: _reveal,
          builder: (context, _) {
            final labelOpacity = ((_reveal.value - 0.55) / 0.45).clamp(0.0, 1.0);
            final content = Stack(
              children: [
                Positioned.fill(
                  child: CustomPaint(
                    painter: _ContourPainter(
                      region: widget.region,
                      canvasSize: Size(w, h),
                      revealProgress: _reveal.value,
                      emphasize: widget.selected,
                    ),
                  ),
                ),
                if (widget.interactive)
                  Positioned.fromRect(
                    rect: box,
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(onTap: widget.onTap),
                    ),
                  ),
                Positioned(
                  left: box.left + 6,
                  top: (box.top - 28).clamp(0.0, h - 28),
                  child: Opacity(
                    opacity: labelOpacity,
                    child: Transform.scale(
                      scale: 0.85 + labelOpacity * 0.15,
                      child: _LabelChip(
                        label: widget.region.labelAr,
                        category: _categoryAr(widget.region.zone),
                        confidence: widget.region.confidence,
                        interactive: widget.interactive,
                      ),
                    ),
                  ),
                ),
              ],
            );
            return content;
          },
        );
      },
    );
  }
}

class _ContourPainter extends CustomPainter {
  final OutfitSegmentRegion region;
  final Size canvasSize;
  final double revealProgress;
  final bool emphasize;

  _ContourPainter({
    required this.region,
    required this.canvasSize,
    this.revealProgress = 1,
    this.emphasize = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final fullPath = _buildPath(size);
    final path = _extractRevealedPath(fullPath, revealProgress);
    if (path.computeMetrics().isEmpty) return;

    final alpha = (0.14 + region.confidence * 0.2 + (emphasize ? 0.12 : 0)).clamp(0.14, 0.46);

    final fill = Paint()
      ..color = AppColors.secondary.withValues(alpha: alpha * revealProgress)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fill);

    // Soft glow — layered strokes (MaskFilter.blur can crash on some iOS GPUs).
    final glow = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.14 * revealProgress)
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, glow);

    final stroke = Paint()
      ..color = AppColors.secondary.withValues(alpha: 0.95)
      ..strokeWidth = 2.2
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, stroke);

    final innerGlow = Paint()
      ..color = Colors.white.withValues(alpha: 0.35 * revealProgress)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    canvas.drawPath(path, innerGlow);

    if (revealProgress > 0.65) {
      final accent = Paint()
        ..color = AppColors.primary
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      if (region.hasContour) {
        _drawCornerHighlights(canvas, path, accent);
      } else {
        _drawRectCorners(canvas, region.normalizedRect, size, accent);
      }
    }
  }

  Path _extractRevealedPath(Path fullPath, double progress) {
    if (progress >= 1) return fullPath;
    final metrics = fullPath.computeMetrics().toList();
    if (metrics.isEmpty) return fullPath;

    final metric = metrics.first;
    final extractLen = metric.length * progress.clamp(0.0, 1.0);
    if (extractLen <= 0) return Path();

    return metric.extractPath(0, extractLen);
  }

  Path _buildPath(Size size) {
    if (region.hasContour) {
      final path = Path();
      final first = region.normalizedPolygon.first;
      path.moveTo(first.dx * size.width, first.dy * size.height);
      for (final p in region.normalizedPolygon.skip(1)) {
        path.lineTo(p.dx * size.width, p.dy * size.height);
      }
      path.close();
      return path;
    }

    final r = region.normalizedRect;
    return Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(
            r.left * size.width,
            r.top * size.height,
            r.width * size.width,
            r.height * size.height,
          ),
          const Radius.circular(10),
        ),
      );
  }

  void _drawCornerHighlights(Canvas canvas, Path path, Paint accent) {
    final metrics = path.computeMetrics().toList();
    if (metrics.isEmpty) return;
    const cornerLen = 14.0;
    final metric = metrics.first;
    final total = metric.length;
    if (total <= 0) return;

    for (var i = 0; i < 4; i++) {
      final t = (total / 4) * i;
      final tangent = metric.getTangentForOffset(t);
      if (tangent == null) continue;
      final p = tangent.position;
      final dir = tangent.vector;
      final len = dir.distance;
      if (len == 0) continue;
      final ux = dir.dx / len;
      final uy = dir.dy / len;
      canvas.drawLine(p, Offset(p.dx + ux * cornerLen, p.dy + uy * cornerLen), accent);
    }
  }

  void _drawRectCorners(Canvas canvas, Rect norm, Size size, Paint accent) {
    const corner = 14.0;
    final left = norm.left * size.width;
    final top = norm.top * size.height;
    final right = norm.right * size.width;
    final bottom = norm.bottom * size.height;

    canvas.drawLine(Offset(left, top), Offset(left + corner, top), accent);
    canvas.drawLine(Offset(left, top), Offset(left, top + corner), accent);
    canvas.drawLine(Offset(right, top), Offset(right - corner, top), accent);
    canvas.drawLine(Offset(right, top), Offset(right, top + corner), accent);
    canvas.drawLine(Offset(left, bottom), Offset(left + corner, bottom), accent);
    canvas.drawLine(Offset(left, bottom), Offset(left, bottom - corner), accent);
    canvas.drawLine(Offset(right, bottom), Offset(right - corner, bottom), accent);
    canvas.drawLine(Offset(right, bottom), Offset(right, bottom - corner), accent);
  }

  @override
  bool shouldRepaint(covariant _ContourPainter oldDelegate) =>
      oldDelegate.region != region ||
      oldDelegate.canvasSize != canvasSize ||
      oldDelegate.revealProgress != revealProgress ||
      oldDelegate.emphasize != emphasize;
}

String _categoryAr(OutfitSegmentZone zone) {
  return switch (zone) {
    OutfitSegmentZone.upperBody => 'علوي',
    OutfitSegmentZone.lowerBody => 'سفلي',
    OutfitSegmentZone.feet => 'حذاء',
    OutfitSegmentZone.accessories => 'إكسسوار',
    _ => '',
  };
}

class _LabelChip extends StatelessWidget {
  final String label;
  final String category;
  final double confidence;
  final bool interactive;

  const _LabelChip({
    required this.label,
    required this.category,
    required this.confidence,
    this.interactive = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.secondary.withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: AppColors.secondary.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.secondary,
              boxShadow: [
                BoxShadow(
                  color: AppColors.secondary.withValues(alpha: 0.6),
                  blurRadius: 6,
                ),
              ],
            ),
          ),
          const SizedBox(width: 7),
          Text(
            label,
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (category.isNotEmpty) ...[
            const SizedBox(width: 5),
            Text(
              '· $category',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
                fontSize: 10,
              ),
            ),
          ],
          if (interactive) ...[
            const SizedBox(width: 5),
            Icon(Icons.touch_app_outlined, size: 12, color: AppColors.secondary),
          ],
          if (confidence > 0) ...[
            const SizedBox(width: 6),
            Text(
              '${(confidence * 100).round()}%',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
                fontSize: 10,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
