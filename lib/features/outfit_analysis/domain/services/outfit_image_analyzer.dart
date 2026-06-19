import 'dart:io';
import 'dart:math' as math;

import 'package:image/image.dart' as img;

import '../entities/outfit_visual_profile.dart';

/// Deterministic pixel-based fallback — colors and structure only, no guessed garments.
abstract final class OutfitImageAnalyzer {
  OutfitImageAnalyzer._();

  static Future<OutfitVisualProfile> analyze(File imageFile) async {
    final bytes = await imageFile.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw Exception('تعذر قراءة صورة الإطلالة');
    }
    final image = img.bakeOrientation(decoded);

    final colors = _extractDominantColors(image);
    final contrast = _contrastLevel(image);
    final formality = _formalityLevel(image, contrast);
    final brightness = _brightnessLevel(image);

    return OutfitVisualProfile(
      labels: const [],
      dominantColors: colors,
      clothingTypes: const [],
      accessoryTypes: const [],
      styleSignals: const [],
      textureHints: const [],
      confidence: 58,
      clothingConfidence: 0,
      source: 'deterministic',
      garmentTypeAr: 'غير مؤكد',
      garmentTypeEn: '',
      styleTypeAr: formality >= 0.6 ? 'كلاسيكي' : 'كاجوال',
      styleTypeEn: formality >= 0.6 ? 'Classic' : 'Casual',
      contrastLevel: contrast,
      formalityLevel: formality,
      brightness: brightness,
    );
  }

  static List<String> _extractDominantColors(img.Image image) {
    final buckets = <String, int>{};
    final step = math.max(1, (image.width * image.height ~/ 6000));

    for (var y = 0; y < image.height; y += step) {
      for (var x = 0; x < image.width; x += step) {
        final p = image.getPixel(x, y);
        final name = _nameColor(p.r.toInt(), p.g.toInt(), p.b.toInt());
        buckets[name] = (buckets[name] ?? 0) + 1;
      }
    }

    final sorted = buckets.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return sorted.take(3).map((e) => e.key).toList();
  }

  static double _contrastLevel(img.Image image) {
    var minL = 255.0;
    var maxL = 0.0;
    final step = math.max(1, (image.width * image.height ~/ 8000));

    for (var y = 0; y < image.height; y += step) {
      for (var x = 0; x < image.width; x += step) {
        final p = image.getPixel(x, y);
        final l = (p.r * 0.299 + p.g * 0.587 + p.b * 0.114);
        minL = math.min(minL, l);
        maxL = math.max(maxL, l);
      }
    }

    return ((maxL - minL) / 255).clamp(0.0, 1.0);
  }

  static double _formalityLevel(img.Image image, double contrast) {
    var saturationSum = 0.0;
    var count = 0;
    final step = math.max(1, (image.width * image.height ~/ 8000));

    for (var y = 0; y < image.height; y += step) {
      for (var x = 0; x < image.width; x += step) {
        final p = image.getPixel(x, y);
        final r = p.r / 255;
        final g = p.g / 255;
        final b = p.b / 255;
        final maxC = math.max(r, math.max(g, b));
        final minC = math.min(r, math.min(g, b));
        final sat = maxC == 0 ? 0.0 : (maxC - minC) / maxC;
        saturationSum += sat;
        count++;
      }
    }

    final avgSat = count == 0 ? 0.4 : saturationSum / count;
    final neutralScore = 1 - avgSat.clamp(0.0, 1.0);
    return (neutralScore * 0.65 + contrast * 0.35).clamp(0.0, 1.0);
  }

  static double _brightnessLevel(img.Image image) {
    var sum = 0.0;
    var count = 0;
    final step = math.max(1, (image.width * image.height ~/ 8000));

    for (var y = 0; y < image.height; y += step) {
      for (var x = 0; x < image.width; x += step) {
        final p = image.getPixel(x, y);
        sum += (p.r * 0.299 + p.g * 0.587 + p.b * 0.114) / 255;
        count++;
      }
    }

    return count == 0 ? 0.5 : (sum / count).clamp(0.0, 1.0);
  }

  static String _nameColor(int r, int g, int b) {
    final candidates = <(String name, int dr, int dg, int db)>[
      ('أسود', 20, 20, 20),
      ('أبيض', 245, 245, 245),
      ('بيج', 210, 190, 160),
      ('كريمي', 235, 225, 200),
      ('رمادي', 128, 128, 128),
      ('كحلي', 25, 40, 80),
      ('أزرق', 40, 80, 180),
      ('زيتوني', 100, 110, 60),
      ('ذهبي', 200, 170, 80),
      ('وردي', 230, 150, 170),
      ('أحمر', 180, 40, 50),
      ('نبيتي', 120, 20, 40),
      ('بني', 120, 80, 50),
      ('فضي', 190, 190, 200),
      ('تركواز', 60, 170, 170),
      ('مرجاني', 240, 120, 100),
    ];

    var best = 'مختلط';
    var bestDist = 1 << 30;
    for (final c in candidates) {
      final d = (r - c.$2) * (r - c.$2) +
          (g - c.$3) * (g - c.$3) +
          (b - c.$4) * (b - c.$4);
      if (d < bestDist) {
        bestDist = d;
        best = c.$1;
      }
    }
    return best;
  }
}
