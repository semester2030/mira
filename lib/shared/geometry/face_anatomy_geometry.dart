import 'dart:math' as math;
import 'dart:ui';

/// Anatomical face bounds — zones stay on skin, not hair or neck.
abstract final class FaceAnatomyGeometry {
  FaceAnatomyGeometry._();

  /// Tighter guide frame: forehead to chin only (excludes hair + neck).
  static Rect computeGuideRect(Size viewport, {double widthFactor = 0.68}) {
    final width = viewport.width * widthFactor;
    const aspect = 1.14;
    final height = width * aspect;
    final left = (viewport.width - width) / 2;
    final top = viewport.height * 0.11;
    return Rect.fromLTWH(left, top, width, height);
  }

  /// Face silhouette — jaw ends above neck; hairline below top of frame.
  static Path outlinePath(Rect r) {
    final hairlineY = r.top + r.height * 0.06;
    final chinY = r.top + r.height * 0.86;
    final cheekY = r.top + r.height * 0.48;
    final jawInset = r.width * 0.06;

    return Path()
      ..moveTo(r.center.dx, hairlineY)
      ..quadraticBezierTo(
        r.right + r.width * 0.03,
        r.top + r.height * 0.20,
        r.right - jawInset,
        cheekY,
      )
      ..quadraticBezierTo(
        r.right - r.width * 0.02,
        r.top + r.height * 0.70,
        r.center.dx,
        chinY,
      )
      ..quadraticBezierTo(
        r.left + r.width * 0.02,
        r.top + r.height * 0.70,
        r.left + jawInset,
        cheekY,
      )
      ..quadraticBezierTo(
        r.left - r.width * 0.03,
        r.top + r.height * 0.20,
        r.center.dx,
        hairlineY,
      )
      ..close();
  }

  static Path zonePath(Rect face, String zoneId) {
    final raw = _rawZonePath(face, zoneId);
    return Path.combine(PathOperation.intersect, outlinePath(face), raw);
  }

  static Map<String, Offset> zoneAnchors(Rect r) {
    return {
      'forehead': Offset(r.center.dx, r.top + r.height * 0.14),
      'under_eye': Offset(r.center.dx, r.top + r.height * 0.30),
      'cheek_left': Offset(r.left + r.width * 0.24, r.top + r.height * 0.46),
      'cheek_right': Offset(r.right - r.width * 0.24, r.top + r.height * 0.46),
      'nose': Offset(r.center.dx, r.top + r.height * 0.50),
      'chin': Offset(r.center.dx, r.top + r.height * 0.74),
      'jawline': Offset(r.center.dx, r.top + r.height * 0.80),
    };
  }

  static Path _rawZonePath(Rect r, String zoneId) {
    switch (zoneId) {
      case 'forehead':
        return Path()
          ..addOval(Rect.fromCenter(
            center: Offset(r.center.dx, r.top + r.height * 0.13),
            width: r.width * 0.62,
            height: r.height * 0.12,
          ));
      case 'under_eye':
        final path = Path();
        final y = r.top + r.height * 0.30;
        path.addOval(Rect.fromCenter(
          center: Offset(r.center.dx - r.width * 0.16, y),
          width: r.width * 0.18,
          height: r.height * 0.06,
        ));
        path.addOval(Rect.fromCenter(
          center: Offset(r.center.dx + r.width * 0.16, y),
          width: r.width * 0.18,
          height: r.height * 0.06,
        ));
        return path;
      case 'cheek_left':
        return Path()
          ..addOval(Rect.fromCenter(
            center: Offset(r.left + r.width * 0.24, r.top + r.height * 0.46),
            width: r.width * 0.22,
            height: r.height * 0.16,
          ));
      case 'cheek_right':
        return Path()
          ..addOval(Rect.fromCenter(
            center: Offset(r.right - r.width * 0.24, r.top + r.height * 0.46),
            width: r.width * 0.22,
            height: r.height * 0.16,
          ));
      case 'nose':
        return Path()
          ..addRRect(RRect.fromRectAndRadius(
            Rect.fromCenter(
              center: Offset(r.center.dx, r.top + r.height * 0.50),
              width: r.width * 0.12,
              height: r.height * 0.14,
            ),
            const Radius.circular(8),
          ));
      case 'chin':
        return Path()
          ..addOval(Rect.fromCenter(
            center: Offset(r.center.dx, r.top + r.height * 0.74),
            width: r.width * 0.26,
            height: r.height * 0.10,
          ));
      case 'jawline':
        return Path()
          ..moveTo(r.left + r.width * 0.20, r.top + r.height * 0.78)
          ..quadraticBezierTo(
            r.center.dx,
            r.top + r.height * 0.82,
            r.right - r.width * 0.20,
            r.top + r.height * 0.78,
          );
      default:
        return Path()..addOval(Rect.fromCenter(center: r.center, width: 1, height: 1));
    }
  }

  /// Scan line clipped horizontally to face width at [t] (0–1).
  static void drawScanLine(
    Canvas canvas,
    Rect face,
    double t,
    Paint paint,
  ) {
    final outline = outlinePath(face);
    final y = face.top + face.height * t;

    final metrics = outline.computeMetrics();
    double leftX = face.center.dx;
    double rightX = face.center.dx;

    for (final metric in metrics) {
      for (var d = 0.0; d < metric.length; d += 2) {
        final tan = metric.getTangentForOffset(d);
        if (tan == null) continue;
        if ((tan.position.dy - y).abs() > 3) continue;
        leftX = math.min(leftX, tan.position.dx);
        rightX = math.max(rightX, tan.position.dx);
      }
    }

    if (rightX > leftX + 8) {
      canvas.drawLine(Offset(leftX + 6, y), Offset(rightX - 6, y), paint);
    }
  }
}
