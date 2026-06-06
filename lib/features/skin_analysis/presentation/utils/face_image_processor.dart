import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:image/image.dart' as img;

/// Crops and normalizes a selfie so YouCam receives a large, centered face.
class FaceImageProcessor {
  FaceImageProcessor._();

  /// Returns a new JPEG optimized for skin analysis (center crop + min resolution).
  static Future<File> prepareForAnalysis(
    File source, {
    required ui.Rect guideRect,
    required ui.Size viewportSize,
  }) async {
    final raw = await source.readAsBytes();
    var decoded = img.decodeImage(raw);
    if (decoded == null) {
      throw Exception('تعذر قراءة الصورة');
    }

    decoded = img.bakeOrientation(decoded);

    final crop = _mapGuideToImageCrop(
      imageWidth: decoded.width,
      imageHeight: decoded.height,
      guideRect: guideRect,
      viewportSize: viewportSize,
    );

    var cropped = img.copyCrop(
      decoded,
      x: crop.left.round(),
      y: crop.top.round(),
      width: crop.width.round(),
      height: crop.height.round(),
    );

    const minShortSide = 960;
    final shortSide = math.min(cropped.width, cropped.height);
    if (shortSide < minShortSide) {
      final scale = minShortSide / shortSide;
      cropped = img.copyResize(
        cropped,
        width: (cropped.width * scale).round(),
        height: (cropped.height * scale).round(),
        interpolation: img.Interpolation.linear,
      );
    }

    final dir = Directory.systemTemp;
    final outPath =
        '${dir.path}/mira_face_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final out = File(outPath);
    await out.writeAsBytes(img.encodeJpg(cropped, quality: 92));
    return out;
  }

  /// Maps on-screen face guide to image coordinates (cover-fit preview math).
  static ui.Rect _mapGuideToImageCrop({
    required int imageWidth,
    required int imageHeight,
    required ui.Rect guideRect,
    required ui.Size viewportSize,
  }) {
    final imageAspect = imageWidth / imageHeight;
    final viewAspect = viewportSize.width / viewportSize.height;

    double scale;
    double offsetX = 0;
    double offsetY = 0;

    if (imageAspect > viewAspect) {
      scale = viewportSize.height / imageHeight;
      offsetX = (viewportSize.width - imageWidth * scale) / 2;
    } else {
      scale = viewportSize.width / imageWidth;
      offsetY = (viewportSize.height - imageHeight * scale) / 2;
    }

    final left = ((guideRect.left - offsetX) / scale).clamp(0.0, imageWidth.toDouble());
    final top = ((guideRect.top - offsetY) / scale).clamp(0.0, imageHeight.toDouble());
    final right = ((guideRect.right - offsetX) / scale).clamp(0.0, imageWidth.toDouble());
    final bottom = ((guideRect.bottom - offsetY) / scale).clamp(0.0, imageHeight.toDouble());

    var cropW = right - left;
    var cropH = bottom - top;

    // Slight expansion so hairline/chin stay inside the crop for YouCam.
    const pad = 0.08;
    final padW = cropW * pad;
    final padH = cropH * pad;
    final expandedLeft = (left - padW).clamp(0.0, imageWidth.toDouble());
    final expandedTop = (top - padH).clamp(0.0, imageHeight.toDouble());
    final expandedRight = (right + padW).clamp(0.0, imageWidth.toDouble());
    final expandedBottom = (bottom + padH).clamp(0.0, imageHeight.toDouble());

    cropW = expandedRight - expandedLeft;
    cropH = expandedBottom - expandedTop;

    return ui.Rect.fromLTWH(expandedLeft, expandedTop, cropW, cropH);
  }
}
