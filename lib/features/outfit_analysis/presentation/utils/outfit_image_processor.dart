import 'dart:io';
import 'dart:math' as math;

import 'package:image/image.dart' as img;

/// Normalizes outfit photos before analysis — orientation, size, exposure.
abstract final class OutfitImageProcessor {
  OutfitImageProcessor._();

  static const _maxEdge = 2048;
  static const _jpegQuality = 92;

  static Future<File> prepareForAnalysis(File source) async {
    var image = await _decodeOriented(source);
    image = _normalizeExposure(image);
    image = _ensureMaxEdge(image, _maxEdge);

    final outPath =
        '${Directory.systemTemp.path}/mira_outfit_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final out = File(outPath);
    await out.writeAsBytes(img.encodeJpg(image, quality: _jpegQuality));
    return out;
  }

  static Future<img.Image> _decodeOriented(File file) async {
    final bytes = await file.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw Exception('تعذر قراءة الصورة — جرّبي JPG أو PNG واضح');
    }
    return img.bakeOrientation(decoded);
  }

  static img.Image _normalizeExposure(img.Image image) {
    final avg = _averageLuminance(image);
    if (avg >= 75 && avg <= 185) return image;

    final factor = avg < 75 ? 1.12 : 0.92;
    return img.adjustColor(image, brightness: factor);
  }

  static double _averageLuminance(img.Image image) {
    var total = 0.0;
    var count = 0;
    final step = math.max(1, (image.width * image.height ~/ 12000));
    for (var y = 0; y < image.height; y += step) {
      for (var x = 0; x < image.width; x += step) {
        final pixel = image.getPixel(x, y);
        total += (pixel.r + pixel.g + pixel.b) / 3;
        count++;
      }
    }
    return count == 0 ? 128 : total / count;
  }

  static img.Image _ensureMaxEdge(img.Image image, int maxEdge) {
    final short = math.min(image.width, image.height);
    if (short <= maxEdge) return image;
    final scale = maxEdge / short;
    return img.copyResize(
      image,
      width: (image.width * scale).round(),
      height: (image.height * scale).round(),
    );
  }
}
