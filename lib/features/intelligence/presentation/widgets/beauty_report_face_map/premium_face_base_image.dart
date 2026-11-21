import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';

/// How the Face Map base layer is rendered.
enum FaceMapBaseMode {
  /// Current analysis only — ephemeral local capture.
  ephemeralUserImage,

  /// History / no capture — clearly non-photographic diagram.
  neutralIllustrative,
}

/// Face base layer — never a photorealistic stock model for the user.
abstract final class PremiumFaceBaseImage {
  PremiumFaceBaseImage._();

  /// Legacy asset — do not use as current-user face in Skin Interactive.
  static const assetPath = 'assets/images/premium_face_base.png';

  static Widget layer({
    required Rect faceBounds,
    FaceMapBaseMode mode = FaceMapBaseMode.neutralIllustrative,
    String? ephemeralUserImagePath,
  }) {
    return Positioned.fromRect(
      rect: faceBounds,
      child: switch (mode) {
        FaceMapBaseMode.ephemeralUserImage => _EphemeralUserFace(
            path: ephemeralUserImagePath,
          ),
        FaceMapBaseMode.neutralIllustrative => const _NeutralIllustrativeFace(),
      },
    );
  }
}

class _EphemeralUserFace extends StatelessWidget {
  const _EphemeralUserFace({required this.path});
  final String? path;

  @override
  Widget build(BuildContext context) {
    if (path == null || path!.isEmpty) {
      return const _NeutralIllustrativeFace();
    }
    final file = File(path!);
    if (!file.existsSync()) {
      return const _NeutralIllustrativeFace();
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: Image.file(
        file,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        filterQuality: FilterQuality.high,
        gaplessPlayback: true,
        excludeFromSemantics: true,
        errorBuilder: (_, __, ___) => const _NeutralIllustrativeFace(),
      ),
    );
  }
}

/// Soft silhouette diagram — not a photo, not a stock model.
class _NeutralIllustrativeFace extends StatelessWidget {
  const _NeutralIllustrativeFace();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _NeutralFacePainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _NeutralFacePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint()
      ..color = AppColors.primaryLight.withValues(alpha: 0.55)
      ..style = PaintingStyle.fill;
    final stroke = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..isAntiAlias = true;

    final oval = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.48),
      width: size.width * 0.78,
      height: size.height * 0.92,
    );
    canvas.drawOval(oval, fill);
    canvas.drawOval(oval, stroke);

    final eyeY = size.height * 0.42;
    final eyeR = size.shortestSide * 0.035;
    canvas.drawCircle(Offset(size.width * 0.35, eyeY), eyeR, stroke);
    canvas.drawCircle(Offset(size.width * 0.65, eyeY), eyeR, stroke);

    final nose = Path()
      ..moveTo(size.width * 0.5, size.height * 0.44)
      ..lineTo(size.width * 0.46, size.height * 0.55)
      ..lineTo(size.width * 0.54, size.height * 0.55);
    canvas.drawPath(nose, stroke);

    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(size.width / 2, size.height * 0.66),
        width: size.width * 0.28,
        height: size.height * 0.08,
      ),
      0.15 * math.pi,
      0.7 * math.pi,
      false,
      stroke,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
