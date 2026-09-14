import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../capture/contracts/face_capture_semantic.dart';
import '../geometry/capture_guide_geometry.dart';
import '../tokens/capture_mirror_tokens.dart';

/// Paints illustrative oval + derived contour (≤18 anchors) for capture mirror.
///
/// Truth: oval = ILLUSTRATIVE · contour = DERIVED · glow = DECORATIVE
class CaptureMirrorPainter extends CustomPainter {
  final List<Offset> contourAnchors;
  final FaceCaptureReadinessState state;
  final bool isReady;
  final double holdProgress01;
  final double pulse;
  final bool reduceMotion;
  final PoseKind poseHint;

  CaptureMirrorPainter({
    required this.contourAnchors,
    required this.state,
    required this.isReady,
    required this.holdProgress01,
    required this.pulse,
    required this.reduceMotion,
    this.poseHint = PoseKind.unknown,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final guide = CaptureGuideGeometry.illustrativeOval(size);
    _drawDim(canvas, size, guide);
    _drawGuideOval(canvas, guide);
    if (contourAnchors.length >= 6) {
      _drawContour(canvas, contourAnchors);
    }
    if (isReady || holdProgress01 > 0) {
      _drawHoldRing(canvas, guide);
    }
    _drawPoseCue(canvas, guide);
  }

  void _drawDim(Canvas canvas, Size size, Rect guide) {
    final alpha = state == FaceCaptureReadinessState.multipleFaces ? 0.55 : 0.38;
    final backdrop = Path()..addRect(Offset.zero & size);
    final hole = Path()..addOval(guide);
    final mask = Path.combine(PathOperation.difference, backdrop, hole);
    canvas.drawPath(
      mask,
      Paint()..color = Colors.black.withValues(alpha: alpha),
    );
  }

  void _drawGuideOval(Canvas canvas, Rect guide) {
    final ready = isReady;
    final color = ready
        ? CaptureMirrorTokens.readyAccent.withValues(alpha: 0.55)
        : CaptureMirrorTokens.guideStroke.withValues(alpha: 0.4);
    canvas.drawOval(
      guide,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = ready ? 2.2 : 1.6,
    );

    // Distance cue: slight oval scale accent (shape, not color-only).
    if (state == FaceCaptureReadinessState.moveCloser ||
        state == FaceCaptureReadinessState.moveFarther) {
      final scale = state == FaceCaptureReadinessState.moveCloser ? 0.92 : 1.08;
      final cue = Rect.fromCenter(
        center: guide.center,
        width: guide.width * scale,
        height: guide.height * scale,
      );
      canvas.drawOval(
        cue,
        Paint()
          ..color = CaptureMirrorTokens.pearl.withValues(alpha: 0.28)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2,
      );
    }
  }

  void _drawContour(Canvas canvas, List<Offset> anchors) {
    final path = Path()..moveTo(anchors.first.dx, anchors.first.dy);
    for (var i = 1; i < anchors.length; i++) {
      final prev = anchors[i - 1];
      final curr = anchors[i];
      final mid = Offset((prev.dx + curr.dx) / 2, (prev.dy + curr.dy) / 2);
      path.quadraticBezierTo(prev.dx, prev.dy, mid.dx, mid.dy);
    }
    path.close();

    final glow = reduceMotion ? 0.55 : 0.45 + pulse * 0.25;
    final stroke = CaptureMirrorTokens.contourForState(
      isReady: isReady,
      hold: state == FaceCaptureReadinessState.holdStill,
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = stroke.withValues(alpha: glow)
        ..style = PaintingStyle.stroke
        ..strokeWidth = isReady ? 2.6 : 2.0
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = CaptureMirrorTokens.pearl.withValues(alpha: 0.22)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0,
    );
  }

  void _drawHoldRing(Canvas canvas, Rect guide) {
    final progress = holdProgress01.clamp(0.0, 1.0);
    if (progress <= 0 && !isReady) return;
    final rect = guide.inflate(10);
    final start = -math.pi / 2;
    final sweep = math.pi * 2 * (isReady && progress <= 0 ? 1.0 : progress);
    canvas.drawArc(
      rect,
      start,
      sweep,
      false,
      Paint()
        ..color = CaptureMirrorTokens.readyAccent.withValues(alpha: 0.75)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round,
    );
  }

  void _drawPoseCue(Canvas canvas, Rect guide) {
    if (poseHint == PoseKind.good || poseHint == PoseKind.unknown) return;
    if (state != FaceCaptureReadinessState.adjustAngle) return;

    // Small edge tick — not a large arrow across the face.
    final paint = Paint()
      ..color = CaptureMirrorTokens.pearl.withValues(alpha: 0.7)
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;

    Offset a;
    Offset b;
    switch (poseHint) {
      case PoseKind.turnLeft:
        a = Offset(guide.left + 8, guide.center.dy);
        b = Offset(guide.left + 22, guide.center.dy);
      case PoseKind.turnRight:
        a = Offset(guide.right - 8, guide.center.dy);
        b = Offset(guide.right - 22, guide.center.dy);
      case PoseKind.lookUp:
        a = Offset(guide.center.dx, guide.top + 8);
        b = Offset(guide.center.dx, guide.top + 22);
      case PoseKind.lookDown:
        a = Offset(guide.center.dx, guide.bottom - 8);
        b = Offset(guide.center.dx, guide.bottom - 22);
      case PoseKind.straighten:
        a = Offset(guide.center.dx - 10, guide.top + 16);
        b = Offset(guide.center.dx + 10, guide.top + 16);
      default:
        return;
    }
    canvas.drawLine(a, b, paint);
  }

  @override
  bool shouldRepaint(covariant CaptureMirrorPainter oldDelegate) {
    return oldDelegate.contourAnchors != contourAnchors ||
        oldDelegate.state != state ||
        oldDelegate.isReady != isReady ||
        oldDelegate.holdProgress01 != holdProgress01 ||
        oldDelegate.pulse != pulse ||
        oldDelegate.reduceMotion != reduceMotion ||
        oldDelegate.poseHint != poseHint;
  }
}
