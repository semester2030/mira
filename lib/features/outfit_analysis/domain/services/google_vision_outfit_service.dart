import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';

import '../../../../core/config/outfit_intelligence_config.dart';
import '../../data/helpers/vision_color_mapper.dart';
import '../entities/outfit_visual_profile.dart';
import 'outfit_segmentation_service.dart';

/// Fashion-only labels accepted from Google Vision.
const allowedFashionLabels = {
  'Dress',
  'Shirt',
  'T-shirt',
  'Blazer',
  'Jacket',
  'Suit',
  'Pants',
  'Jeans',
  'Skirt',
  'Coat',
  'Shoes',
  'Bag',
  'Accessory',
  'Sweater',
  'Hoodie',
};

const _rejectedVisionNoise = {
  'glasses',
  'eyewear',
  'chin',
  'cheek',
  'vision care',
  'sleeve',
  'face',
  'hair',
  'lip',
  'skin',
};

const _clothingConfidenceThreshold = 0.72;

/// Parses Google Cloud Vision annotate responses into [OutfitVisualProfile].
class GoogleVisionResponseParser {
  const GoogleVisionResponseParser();

  OutfitVisualProfile parse(Map<String, dynamic> response) {
    final labelAnnotations =
        (response['labelAnnotations'] as List<dynamic>?) ?? const [];

    final filteredLabels = _filterFashionLabels(labelAnnotations);
    final labels = filteredLabels.map((e) => e.label).toList();

    final dominantColors = _extractDominantColors(response);
    final objectHits = _extractFashionObjects(response);
    final brightness = _brightnessFromResponse(response);

    final clothingTypes = <String>[];
    final accessoryTypes = <String>[];
    final styleSignals = <String>[];
    final textureHints = <String>[];
    var bestClothingConfidence = 0.0;

    for (final hit in filteredLabels) {
      final lower = hit.label.toLowerCase();
      final ar = VisionColorMapper.labelToArabic(hit.label);
      if (_isAccessoryLabel(lower)) {
        if (!accessoryTypes.contains(ar)) accessoryTypes.add(ar);
      } else if (_isAllowedFashionLabel(hit.label)) {
        if (!clothingTypes.contains(ar)) clothingTypes.add(ar);
        bestClothingConfidence =
            bestClothingConfidence > hit.score ? bestClothingConfidence : hit.score;
      }
      if (_isStyleSignal(lower) && !styleSignals.contains(ar)) {
        styleSignals.add(ar);
      }
      if (_isTexture(lower) && !textureHints.contains(ar)) {
        textureHints.add(ar);
      }
    }

    for (final hit in objectHits) {
      final ar = VisionColorMapper.labelToArabic(hit.label);
      if (_isAccessoryLabel(hit.label.toLowerCase())) {
        if (!accessoryTypes.contains(ar)) accessoryTypes.add(ar);
      } else {
        if (!clothingTypes.contains(ar)) clothingTypes.add(ar);
        bestClothingConfidence =
            bestClothingConfidence > hit.score ? bestClothingConfidence : hit.score;
      }
    }

    final formality = _formalityFromSignals(styleSignals, labels);
    final contrast = _contrastFromColors(dominantColors);

    final garmentAr = bestClothingConfidence >= _clothingConfidenceThreshold
        ? (clothingTypes.firstOrNull ?? 'غير مؤكد')
        : 'غير مؤكد';
    final styleAr =
        styleSignals.firstOrNull ?? (formality >= 0.6 ? 'كلاسيكي' : 'عصري');

    final avgScore = filteredLabels.isEmpty
        ? 0.55
        : filteredLabels
                .take(5)
                .map((e) => e.score)
                .fold<double>(0, (a, b) => a + b) /
            filteredLabels.take(5).length;

    return OutfitVisualProfile(
      labels: labels.take(12).toList(),
      dominantColors: dominantColors,
      clothingTypes: clothingTypes.take(6).toList(),
      accessoryTypes: accessoryTypes.take(6).toList(),
      styleSignals: styleSignals.take(6).toList(),
      textureHints: textureHints.take(4).toList(),
      confidence: (avgScore * 100).round().clamp(55, 96),
      clothingConfidence: bestClothingConfidence,
      source: 'google_vision',
      garmentTypeAr: garmentAr,
      garmentTypeEn: objectHits.firstOrNull?.label ?? labels.firstOrNull ?? '',
      styleTypeAr: styleAr,
      styleTypeEn: styleSignals.firstOrNull ?? 'Style',
      contrastLevel: contrast,
      formalityLevel: formality,
      brightness: brightness,
    );
  }

  List<_VisionLabelHit> _filterFashionLabels(List<dynamic> labelAnnotations) {
    final hits = <_VisionLabelHit>[];
    for (final entry in labelAnnotations) {
      final map = entry as Map;
      final label = map['description']?.toString() ?? '';
      if (label.isEmpty || _isRejectedNoise(label)) continue;
      if (!_isAllowedFashionLabel(label) &&
          !_isAccessoryLabel(label.toLowerCase()) &&
          !_isStyleSignal(label.toLowerCase()) &&
          !_isTexture(label.toLowerCase())) {
        continue;
      }
      hits.add(
        _VisionLabelHit(
          label: label,
          score: ((map['score'] as num?)?.toDouble() ?? 0.5).clamp(0.0, 1.0),
        ),
      );
    }
    return hits;
  }

  List<_VisionLabelHit> _extractFashionObjects(Map<String, dynamic> response) {
    final localized = response['localizedObjectAnnotations'] as List<dynamic>?;
    if (localized == null) return const [];

    final hits = <_VisionLabelHit>[];
    for (final entry in localized) {
      final map = entry as Map;
      final name = map['name']?.toString() ?? '';
      if (name.isEmpty || _isRejectedNoise(name)) continue;
      if (!_isAllowedFashionLabel(name) && !_isAccessoryLabel(name.toLowerCase())) {
        continue;
      }
      hits.add(
        _VisionLabelHit(
          label: name,
          score: ((map['score'] as num?)?.toDouble() ?? 0.5).clamp(0.0, 1.0),
        ),
      );
    }
    return hits;
  }

  bool _isAllowedFashionLabel(String label) {
    final lower = label.toLowerCase();
    if (_isRejectedNoise(label)) return false;
    for (final allowed in allowedFashionLabels) {
      final allowedLower = allowed.toLowerCase();
      if (lower == allowedLower ||
          lower.contains(allowedLower) ||
          allowedLower.contains(lower)) {
        if (_isAccessoryLabel(lower) && allowedLower != 'bag' && allowedLower != 'shoes') {
          continue;
        }
        return true;
      }
    }
    return false;
  }

  bool _isRejectedNoise(String label) {
    final lower = label.trim().toLowerCase();
    for (final noise in _rejectedVisionNoise) {
      final pattern = RegExp(r'(^|\s)' + RegExp.escape(noise) + r'($|\s)');
      if (lower == noise || pattern.hasMatch(lower)) return true;
    }
    return false;
  }

  List<String> _extractDominantColors(Map<String, dynamic> response) {
    final props = response['imagePropertiesAnnotation'] as Map<String, dynamic>?;
    final colors =
        (props?['dominantColors']?['colors'] as List<dynamic>?) ?? const [];
    return colors
        .take(4)
        .map((c) {
          final color = (c as Map)['color'] as Map<String, dynamic>? ?? {};
          final r = (color['red'] as num?)?.toDouble() ?? 128;
          final g = (color['green'] as num?)?.toDouble() ?? 128;
          final b = (color['blue'] as num?)?.toDouble() ?? 128;
          return VisionColorMapper.fromRgb(r / 255, g / 255, b / 255);
        })
        .toSet()
        .toList();
  }

  double _brightnessFromResponse(Map<String, dynamic> response) {
    final props = response['imagePropertiesAnnotation'] as Map<String, dynamic>?;
    final colors =
        (props?['dominantColors']?['colors'] as List<dynamic>?) ?? const [];
    if (colors.isEmpty) return 0.5;

    var sum = 0.0;
    var weight = 0.0;
    for (final entry in colors) {
      final map = entry as Map;
      final color = map['color'] as Map<String, dynamic>? ?? {};
      final fraction = (map['pixelFraction'] as num?)?.toDouble() ?? 0.25;
      final r = (color['red'] as num?)?.toDouble() ?? 128;
      final g = (color['green'] as num?)?.toDouble() ?? 128;
      final b = (color['blue'] as num?)?.toDouble() ?? 128;
      final luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      sum += luminance * fraction;
      weight += fraction;
    }
    if (weight == 0) return 0.5;
    return (sum / weight).clamp(0.0, 1.0);
  }

  double _formalityFromSignals(List<String> styleSignals, List<String> labels) {
    final joined = [...styleSignals, ...labels].join(' ').toLowerCase();
    if (joined.contains('formal') ||
        joined.contains('business') ||
        joined.contains('suit')) {
      return 0.82;
    }
    if (joined.contains('casual') || joined.contains('street')) return 0.38;
    if (joined.contains('elegant') || joined.contains('classic')) return 0.68;
    return 0.55;
  }

  double _contrastFromColors(List<String> colors) {
    if (colors.length >= 3) return 0.72;
    if (colors.contains('أسود') &&
        (colors.contains('أبيض') || colors.contains('كريمي'))) {
      return 0.85;
    }
    if (colors.length == 2) return 0.58;
    return 0.42;
  }

  bool _isAccessoryLabel(String lower) =>
      lower.contains('bag') ||
      lower.contains('shoe') ||
      lower.contains('accessory') ||
      lower.contains('jewelry') ||
      lower.contains('watch');

  bool _isStyleSignal(String lower) =>
      lower.contains('formal') ||
      lower.contains('casual') ||
      lower.contains('elegant') ||
      lower.contains('classic') ||
      lower.contains('modern') ||
      lower.contains('minimal');

  bool _isTexture(String lower) =>
      lower.contains('silk') ||
      lower.contains('denim') ||
      lower.contains('leather') ||
      lower.contains('cotton') ||
      lower.contains('linen');
}

class _VisionLabelHit {
  const _VisionLabelHit({required this.label, required this.score});

  final String label;
  final double score;
}

/// Google Cloud Vision outfit analyzer — Flutter-only, local API key via dart-define.
class OutfitVisionResult {
  const OutfitVisionResult({
    required this.profile,
    this.localizedObjects = const [],
    this.rawResponse,
  });

  final OutfitVisualProfile profile;
  final List<VisionLocalizedObject> localizedObjects;
  final Map<String, dynamic>? rawResponse;
}

class GoogleVisionOutfitService {
  GoogleVisionOutfitService({
    Dio? dio,
    GoogleVisionResponseParser? parser,
  })  : _dio = dio ?? Dio(),
        _parser = parser ?? const GoogleVisionResponseParser();

  final Dio _dio;
  final GoogleVisionResponseParser _parser;

  Future<OutfitVisualProfile> analyze(File imageFile) async {
    final result = await analyzeWithObjects(imageFile);
    return result.profile;
  }

  Future<OutfitVisionResult> analyzeWithObjects(File imageFile) async {
    if (!OutfitIntelligenceConfig.hasGoogleVision) {
      throw StateError('Google Vision API key not configured');
    }

    final bytes = await imageFile.readAsBytes();
    final base64Image = base64Encode(bytes);
    final apiKey = OutfitIntelligenceConfig.googleVisionApiKey;

    final response = await _dio.post<Map<String, dynamic>>(
      'https://vision.googleapis.com/v1/images:annotate',
      queryParameters: {'key': apiKey},
      data: {
        'requests': [
          {
            'image': {'content': base64Image},
            'features': [
              {'type': 'LABEL_DETECTION', 'maxResults': 25},
              {'type': 'IMAGE_PROPERTIES'},
              {'type': 'OBJECT_LOCALIZATION', 'maxResults': 20},
            ],
          },
        ],
      },
      options: Options(
        sendTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 45),
      ),
    );

    final responses = response.data?['responses'] as List<dynamic>?;
    if (responses == null || responses.isEmpty) {
      throw Exception('Google Vision returned empty response');
    }

    final first = responses.first as Map<String, dynamic>;
    if (first['error'] != null) {
      throw Exception('Google Vision error: ${first['error']}');
    }

    return OutfitVisionResult(
      profile: _parser.parse(first),
      localizedObjects: parseVisionLocalizedObjects(first),
      rawResponse: first,
    );
  }
}

extension _FirstOrNull<E> on List<E> {
  E? get firstOrNull => isEmpty ? null : first;
}
