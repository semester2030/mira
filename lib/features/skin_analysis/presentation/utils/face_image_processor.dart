import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:image/image.dart' as img;

/// Prepares selfie JPEGs for YouCam — same crop as on-screen preview + auto enhancement.
class FaceImageProcessor {
  FaceImageProcessor._();

  /// Set by [FaceCapturePanel] so upload matches the preview frame.
  static double? viewportAspectRatio;

  /// Center crop + face zoom + exposure fix for YouCam upload.
  ///
  /// [boostLevel] 0 = normal, 1 = extra zoom/brightness if first attempt failed.
  static Future<File> prepareForAnalysis(
    File source, {
    int boostLevel = 0,
  }) async {
    var image = await _decodeOriented(source);

    final aspect = viewportAspectRatio ?? (image.width / image.height);
    image = _centerCropToAspect(image, aspect);

    final zoom = boostLevel > 0 ? 0.72 : 0.82;
    image = _centerZoom(image, zoom);

    image = _normalizeExposure(image, boostLevel: boostLevel);
    image = _ensureMinShortSide(image, 1280);

    final outPath =
        '${Directory.systemTemp.path}/mira_face_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final out = File(outPath);
    await out.writeAsBytes(img.encodeJpg(image, quality: 94));
    return out;
  }

  static Future<ui.Size> decodeOrientedSize(File file) async {
    final oriented = await _decodeOriented(file);
    return ui.Size(oriented.width.toDouble(), oriented.height.toDouble());
  }

  /// JPEG bytes with EXIF orientation applied — matches what the user saw in frame.
  static Future<Uint8List> readOrientedJpegBytes(
    File file, {
    int quality = 95,
    double? targetAspectRatio,
  }) async {
    var oriented = await _decodeOriented(file);
    if (targetAspectRatio != null && targetAspectRatio > 0) {
      oriented = _centerCropToAspect(oriented, targetAspectRatio);
    }
    return Uint8List.fromList(img.encodeJpg(oriented, quality: quality));
  }

  static img.Image _centerCropToAspect(img.Image source, double targetAspectRatio) {
    final sourceAspect = source.width / source.height;
    if ((sourceAspect - targetAspectRatio).abs() < 0.01) {
      return source;
    }

    if (sourceAspect > targetAspectRatio) {
      final cropWidth = (source.height * targetAspectRatio).round();
      final left = ((source.width - cropWidth) / 2).round().clamp(0, source.width - 1);
      return img.copyCrop(
        source,
        x: left,
        y: 0,
        width: math.min(cropWidth, source.width - left),
        height: source.height,
      );
    }

    final cropHeight = (source.width / targetAspectRatio).round();
    final top = ((source.height - cropHeight) / 2).round().clamp(0, source.height - 1);
    return img.copyCrop(
      source,
      x: 0,
      y: top,
      width: source.width,
      height: math.min(cropHeight, source.height - top),
    );
  }

  static img.Image _centerZoom(img.Image source, double fraction) {
    final cropW = (source.width * fraction).round().clamp(1, source.width);
    final cropH = (source.height * fraction).round().clamp(1, source.height);
    final left = ((source.width - cropW) / 2).round().clamp(0, source.width - 1);
    final top = ((source.height - cropH) / 2).round().clamp(0, source.height - 1);

    final cropped = img.copyCrop(
      source,
      x: left,
      y: top,
      width: math.min(cropW, source.width - left),
      height: math.min(cropH, source.height - top),
    );

    return img.copyResize(
      cropped,
      width: source.width,
      height: source.height,
      interpolation: img.Interpolation.linear,
    );
  }

  static img.Image _normalizeExposure(img.Image source, {int boostLevel = 0}) {
    final avg = _averageCenterLuminance(source);
    final target = 118.0 + (boostLevel * 12);

    if (avg < target) {
      final factor = (target / math.max(avg, 24)).clamp(1.0, 1.75);
      return img.adjustColor(
        source,
        brightness: ((factor - 1) * 0.55).clamp(0.0, 0.35),
        contrast: 1.04 + (boostLevel * 0.03),
        gamma: avg < 70 ? 0.88 : 0.94,
      );
    }

    if (avg > 210) {
      return img.adjustColor(source, brightness: -0.06, contrast: 0.98);
    }

    return source;
  }

  static double _averageCenterLuminance(img.Image source) {
    final left = (source.width * 0.2).round();
    final top = (source.height * 0.15).round();
    final right = (source.width * 0.8).round();
    final bottom = (source.height * 0.85).round();

    var sum = 0.0;
    var count = 0;
    final step = math.max(1, (source.width / 48).round());

    for (var y = top; y < bottom; y += step) {
      for (var x = left; x < right; x += step) {
        final pixel = source.getPixel(x, y);
        sum += 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
        count++;
      }
    }

    return count == 0 ? 128 : sum / count;
  }

  static img.Image _ensureMinShortSide(img.Image source, int minShortSide) {
    final shortSide = math.min(source.width, source.height);
    if (shortSide >= minShortSide) return source;

    final scale = minShortSide / shortSide;
    return img.copyResize(
      source,
      width: (source.width * scale).round(),
      height: (source.height * scale).round(),
      interpolation: img.Interpolation.linear,
    );
  }

  static Future<img.Image> _decodeOriented(File file) async {
    final raw = await file.readAsBytes();
    final decoded = img.decodeImage(raw);
    if (decoded == null) {
      throw Exception('تعذر قراءة الصورة');
    }
    return img.bakeOrientation(decoded);
  }
}
