import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/services/google_vision_outfit_service.dart';

void main() {
  const parser = GoogleVisionResponseParser();

  group('GoogleVisionResponseParser', () {
    test('extracts dominant colors, clothing, and formality from Vision payload', () {
      final profile = parser.parse(_sampleVisionResponse());

      expect(profile.source, 'google_vision');
      expect(profile.dominantColors, contains('ذهبي'));
      expect(profile.clothingType, isNot('غير مؤكد'));
      expect(profile.labels, contains('Dress'));
      expect(profile.labels, isNot(contains('Fashion')));
      expect(profile.formalness, greaterThan(0.7));
      expect(profile.brightness, greaterThan(0.3));
      expect(profile.clothingConfidence, greaterThanOrEqualTo(0.72));
      expect(profile.confidence, inInclusiveRange(55, 96));
    });

    test('removes noisy non-fashion labels', () {
      final profile = parser.parse({
        'labelAnnotations': [
          {'description': 'Dress', 'score': 0.93},
          {'description': 'Glasses', 'score': 0.91},
          {'description': 'Eyewear', 'score': 0.88},
          {'description': 'Chin', 'score': 0.86},
          {'description': 'Face', 'score': 0.84},
          {'description': 'Hair', 'score': 0.82},
          {'description': 'Sleeve', 'score': 0.80},
        ],
        'imagePropertiesAnnotation': {
          'dominantColors': {
            'colors': [
              {
                'color': {'red': 200, 'green': 170, 'blue': 80},
                'pixelFraction': 0.42,
              },
            ],
          },
        },
      });

      expect(profile.labels, contains('Dress'));
      expect(profile.labels, isNot(contains('Glasses')));
      expect(profile.labels, isNot(contains('Face')));
      expect(profile.labels, isNot(contains('Hair')));
      expect(profile.labels, isNot(contains('Sleeve')));
    });

    test('marks clothing as uncertain when confidence is below threshold', () {
      final profile = parser.parse({
        'labelAnnotations': [
          {'description': 'Dress', 'score': 0.61},
        ],
        'localizedObjectAnnotations': [
          {'name': 'Dress', 'score': 0.58},
        ],
      });

      expect(profile.clothingConfidence, lessThan(0.72));
      expect(profile.garmentTypeAr, 'غير مؤكد');
    });

    test('detects accessories and textures from allowed labels', () {
      final profile = parser.parse({
        'labelAnnotations': [
          {'description': 'Handbag', 'score': 0.91},
          {'description': 'Silk', 'score': 0.84},
          {'description': 'Casual', 'score': 0.77},
        ],
        'imagePropertiesAnnotation': {
          'dominantColors': {
            'colors': [
              {
                'color': {'red': 40, 'green': 80, 'blue': 180},
                'pixelFraction': 0.55,
              },
            ],
          },
        },
      });

      expect(profile.accessoryTypes, isNotEmpty);
      expect(profile.texture, isNotEmpty);
      expect(profile.formalness, lessThan(0.5));
      expect(profile.dominantColors, contains('أزرق'));
    });

    test('computes high contrast for black and white palette', () {
      final profile = parser.parse({
        'labelAnnotations': [
          {'description': 'Suit', 'score': 0.8},
        ],
        'imagePropertiesAnnotation': {
          'dominantColors': {
            'colors': [
              {
                'color': {'red': 20, 'green': 20, 'blue': 20},
                'pixelFraction': 0.5,
              },
              {
                'color': {'red': 245, 'green': 245, 'blue': 245},
                'pixelFraction': 0.4,
              },
            ],
          },
        },
      });

      expect(profile.contrastLevel, greaterThan(0.8));
    });
  });
}

Map<String, dynamic> _sampleVisionResponse() {
  return {
    'labelAnnotations': [
      {'description': 'Dress', 'score': 0.95},
      {'description': 'Fashion', 'score': 0.88},
      {'description': 'Formal wear', 'score': 0.75},
    ],
    'imagePropertiesAnnotation': {
      'dominantColors': {
        'colors': [
          {
            'color': {'red': 200, 'green': 170, 'blue': 80},
            'pixelFraction': 0.42,
          },
          {
            'color': {'red': 20, 'green': 20, 'blue': 20},
            'pixelFraction': 0.28,
          },
        ],
      },
    },
    'localizedObjectAnnotations': [
      {'name': 'Dress', 'score': 0.9},
    ],
  };
}
